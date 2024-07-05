import getTrojanURIParser from "@/utils/trojan-uri";

export default function parseUri(uri: string): IProxyConfig {
  const head = uri.split("://")[0];
  switch (head) {
    case "ss":
      return URI_SS(uri);
    case "ssr":
      return URI_SSR(uri);
    case "vmess":
      return URI_VMESS(uri);
    case "vless":
      return URI_VLESS(uri);
    case "trojan":
      return URI_Trojan(uri);
    case "hysteria2":
      return URI_Hysteria2(uri);
    case "hy2":
      return URI_Hysteria2(uri);
    case "hysteria":
      return URI_Hysteria(uri);
    case "hy":
      return URI_Hysteria(uri);
    case "tuic":
      return URI_TUIC(uri);
    case "wireguard":
      return URI_Wireguard(uri);
    case "wg":
      return URI_Wireguard(uri);
    case "http":
      return URI_HTTP(uri);
    case "socks5":
      return URI_SOCKS(uri);
    default:
      throw Error(`Unknown uri type: ${head}`);
  }
}

function getIfNotBlank(
  value: string | undefined,
  dft?: string
): string | undefined {
  return value && value.trim() !== "" ? value : dft;
}

function getIfPresent(value: any, dft?: any): any {
  return value ? value : dft;
}

function isPresent(value: any): boolean {
  return value !== null && value !== undefined;
}

function isNotBlank(name: string) {
  return name.trim().length !== 0;
}

function isIPv4(address: string): boolean {
  // Check if the address is IPv4
  const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  return ipv4Regex.test(address);
}

function isIPv6(address: string): boolean {
  // Check if the address is IPv6
  const ipv6Regex =
    /^((?=.*(::))(?!.*\3.+)(::)?)([0-9A-Fa-f]{1,4}(\3|:\b)|\3){7}[0-9A-Fa-f]{1,4}$/;
  return ipv6Regex.test(address);
}

function decodeBase64OrOriginal(str: string): string {
  try {
    return atob(str);
  } catch {
    return str;
  }
}

function URI_SS(line: string): IProxyConfig {
  // parse url
  let content = line.split("ss://")[1];

  const proxy: IProxyConfig = {
    name: decodeURIComponent(line.split("#")[1]),
    type: "ss",
    server: "",
    port: 0,
  };
  content = content.split("#")[0]; // strip proxy name
  // handle IPV4 and IPV6
  let serverAndPortArray = content.match(/@([^/]*)(\/|$)/);
  let userInfoStr = decodeBase64OrOriginal(content.split("@")[0]);
  let query = "";
  if (!serverAndPortArray) {
    if (content.includes("?")) {
      const parsed = content.match(/^(.*)(\?.*)$/);
      content = parsed?.[1] ?? "";
      query = parsed?.[2] ?? "";
    }
    content = decodeBase64OrOriginal(content);
    if (query) {
      if (/(&|\?)v2ray-plugin=/.test(query)) {
        const parsed = query.match(/(&|\?)v2ray-plugin=(.*?)(&|$)/);
        let v2rayPlugin = parsed![2];
        if (v2rayPlugin) {
          proxy.plugin = "v2ray-plugin";
          proxy["plugin-opts"] = JSON.parse(
            decodeBase64OrOriginal(v2rayPlugin)
          );
        }
      }
      content = `${content}${query}`;
    }
    userInfoStr = content.split("@")[0];
    serverAndPortArray = content.match(/@([^/]*)(\/|$)/);
  }
  const serverAndPort = serverAndPortArray?.[1];
  const portIdx = serverAndPort?.lastIndexOf(":") ?? 0;
  proxy.server = serverAndPort?.substring(0, portIdx) ?? "";
  proxy.port = parseInt(
    `${serverAndPort?.substring(portIdx + 1)}`.match(/\d+/)?.[0] ?? ""
  );
  console.log(userInfoStr);
  const userInfo = userInfoStr.match(/(^.*?):(.*$)/);
  console.log(userInfo);
  proxy.cipher = userInfo?.[1];
  proxy.password = userInfo?.[2];

  // handle obfs
  const idx = content.indexOf("?plugin=");
  if (idx !== -1) {
    const pluginInfo = (
      "plugin=" + decodeURIComponent(content.split("?plugin=")[1].split("&")[0])
    ).split(";");
    const params: Record<string, any> = {};
    for (const item of pluginInfo) {
      const [key, val] = item.split("=");
      if (key) params[key] = val || true; // some options like "tls" will not have value
    }
    switch (params.plugin) {
      case "obfs-local":
      case "simple-obfs":
        proxy.plugin = "obfs";
        proxy["plugin-opts"] = {
          mode: params.obfs,
          host: getIfNotBlank(params["obfs-host"]),
        };
        break;
      case "v2ray-plugin":
        proxy.plugin = "v2ray-plugin";
        proxy["plugin-opts"] = {
          mode: "websocket",
          host: getIfNotBlank(params["obfs-host"]),
          path: getIfNotBlank(params.path),
          tls: getIfPresent(params.tls),
        };
        break;
      default:
        throw new Error(`Unsupported plugin option: ${params.plugin}`);
    }
  }
  if (/(&|\?)uot=(1|true)/i.test(query)) {
    proxy["udp-over-tcp"] = true;
  }
  if (/(&|\?)tfo=(1|true)/i.test(query)) {
    proxy.tfo = true;
  }
  return proxy;
}

function URI_SSR(line: string): IProxyConfig {
  line = decodeBase64OrOriginal(line.split("ssr://")[1]);

  // handle IPV6 & IPV4 format
  let splitIdx = line.indexOf(":origin");
  if (splitIdx === -1) {
    splitIdx = line.indexOf(":auth_");
  }
  const serverAndPort = line.substring(0, splitIdx);
  const server = serverAndPort.substring(0, serverAndPort.lastIndexOf(":"));
  const port = parseInt(
    serverAndPort.substring(serverAndPort.lastIndexOf(":") + 1)
  );

  let params = line
    .substring(splitIdx + 1)
    .split("/?")[0]
    .split(":");
  let proxy: IProxyConfig = {
    name: "",
    type: "ssr",
    server,
    port,
    protocol: params[0],
    cipher: params[1],
    obfs: params[2],
    password: decodeBase64OrOriginal(params[3]),
  };

  // get other params
  const other_params: Record<string, string> = {};
  const paramsArray = line.split("/?")[1]?.split("&") || [];
  for (const item of paramsArray) {
    const [key, val] = item.split("=");
    if (val?.trim().length > 0) {
      other_params[key] = val.trim();
    }
  }

  proxy = {
    ...proxy,
    name: other_params.remarks
      ? decodeBase64OrOriginal(other_params.remarks)
      : proxy.server,
    "protocol-param": getIfNotBlank(
      decodeBase64OrOriginal(other_params.protoparam || "").replace(/\s/g, "")
    ),
    "obfs-param": getIfNotBlank(
      decodeBase64OrOriginal(other_params.obfsparam || "").replace(/\s/g, "")
    ),
  };
  return proxy;
}

function URI_VMESS(line: string): IProxyConfig {
  line = line.split("vmess://")[1];
  let content = decodeBase64OrOriginal(line);
  console.log(content);
  if (/=\s*vmess/.test(content)) {
    // Quantumult VMess URI format
    const partitions = content.split(",").map((p) => p.trim());
    console.log(partitions);
    const params: Record<string, string> = {};
    for (const part of partitions) {
      if (part.indexOf("=") !== -1) {
        const [key, val] = part.split("=");
        params[key.trim()] = val.trim();
      }
    }

    const proxy: IProxyConfig = {
      name: partitions[0].split("=")[0].trim(),
      type: "vmess",
      server: partitions[1],
      port: parseInt(partitions[2], 10),
      cipher: getIfNotBlank(partitions[3], "auto"),
      uuid: partitions[4].match(/^"(.*)"$/)?.[1] || "",
      tls: params.obfs === "wss",
      udp: getIfPresent(params["udp-relay"]),
      tfo: getIfPresent(params["fast-open"]),
      "skip-cert-verify": isPresent(params["tls-verification"])
        ? !params["tls-verification"]
        : undefined,
    };

    if (isPresent(params.obfs)) {
      if (params.obfs === "ws" || params.obfs === "wss") {
        proxy.network = "ws";
        proxy["ws-opts"] = {
          path:
            (getIfNotBlank(params["obfs-path"]) || '"/"').match(
              /^"(.*)"$/
            )?.[1] || "/",
          headers: {
            Host:
              params["obfs-header"]?.match(/Host:\s*([a-zA-Z0-9-.]*)/)?.[1] ||
              "",
          },
        };
      } else {
        throw new Error(`Unsupported obfs: ${params.obfs}`);
      }
    }

    return proxy;
  } else {
    let params: Record<string, any> = {};

    try {
      // V2rayN URI format
      params = JSON.parse(content);
    } catch (e) {
      // Shadowrocket URI format
      const match = /(^[^?]+?)\/?\?(.*)$/.exec(line);
      if (match) {
        let [_, base64Line, qs] = match;
        content = decodeBase64OrOriginal(base64Line);

        for (const addon of qs.split("&")) {
          const [key, valueRaw] = addon.split("=");
          const value = decodeURIComponent(valueRaw);
          if (value.indexOf(",") === -1) {
            params[key] = value;
          } else {
            params[key] = value.split(",");
          }
        }

        const contentMatch = /(^[^:]+?):([^:]+?)@(.*):(\d+)$/.exec(content);

        if (contentMatch) {
          let [__, cipher, uuid, server, port] = contentMatch;

          params.scy = cipher;
          params.id = uuid;
          params.port = port;
          params.add = server;
        }
      }
    }
    console.log(params);
    const server = params.add;
    const port = parseInt(getIfPresent(params.port), 10);
    const proxy: IProxyConfig = {
      name:
        params.ps ??
        params.remarks ??
        params.remark ??
        `VMess ${server}:${port}`,
      type: "vmess",
      server,
      port,
      cipher: getIfPresent(params.scy, "auto"),
      uuid: params.id,
      alterId: parseInt(getIfPresent(params.aid ?? params.alterId, 0), 10),
      tls: ["tls", true, 1, "1"].includes(params.tls),
      "skip-cert-verify": isPresent(params.verify_cert)
        ? !params.verify_cert
        : undefined,
    };

    if (proxy.tls && params.sni) {
      proxy.sni = params.sni;
    }

    let httpupgrade = false;
    if (params.net === "ws" || params.obfs === "websocket") {
      proxy.network = "ws";
    } else if (
      ["http"].includes(params.net) ||
      ["http"].includes(params.obfs) ||
      ["http"].includes(params.type)
    ) {
      proxy.network = "http";
    } else if (["grpc"].includes(params.net)) {
      proxy.network = "grpc";
    } else if (params.net === "httpupgrade") {
      proxy.network = "ws";
      httpupgrade = true;
    } else if (params.net === "h2" || proxy.network === "h2") {
      proxy.network = "h2";
    }

    if (proxy.network) {
      let transportHost = params.host ?? params.obfsParam;
      try {
        const parsedObfs = JSON.parse(transportHost);
        const parsedHost = parsedObfs?.Host;
        if (parsedHost) {
          transportHost = parsedHost;
        }
      } catch (e) {
        // ignore JSON parse errors
      }

      let transportPath = params.path;
      if (proxy.network === "http") {
        if (transportHost) {
          transportHost = Array.isArray(transportHost)
            ? transportHost[0]
            : transportHost;
        }
        if (transportPath) {
          transportPath = Array.isArray(transportPath)
            ? transportPath[0]
            : transportPath;
        } else {
          transportPath = "/";
        }
      }

      if (transportPath || transportHost) {
        if (["grpc"].includes(proxy.network)) {
          proxy[`grpc-opts`] = {
            "grpc-service-name": getIfNotBlank(transportPath),
            "_grpc-type": getIfNotBlank(params.type),
          };
        } else {
          const opts: Record<string, any> = {
            path: getIfNotBlank(transportPath),
            headers: { Host: getIfNotBlank(transportHost) },
          };
          if (httpupgrade) {
            opts["v2ray-http-upgrade"] = true;
            opts["v2ray-http-upgrade-fast-open"] = true;
          }
          proxy[`${proxy.network}-opts`] = opts;
        }
      } else {
        delete proxy.network;
      }

      if (proxy.tls && !proxy.sni && transportHost) {
        proxy.sni = transportHost;
      }
    }

    return proxy;
  }
}

function URI_VLESS(line: string): IProxyConfig {
  line = line.split("vless://")[1];
  let isShadowrocket;
  let parsed = /^(.*?)@(.*?):(\d+)\/?(\?(.*?))?(?:#(.*?))?$/.exec(line)!;
  if (!parsed) {
    let [_, base64, other] = /^(.*?)(\?.*?$)/.exec(line)!;
    line = `${atob(base64)}${other}`;
    parsed = /^(.*?)@(.*?):(\d+)\/?(\?(.*?))?(?:#(.*?))?$/.exec(line)!;
    isShadowrocket = true;
  }
  let [__, uuid, server, portStr, ___, addons = "", name] = parsed;
  if (isShadowrocket) {
    uuid = uuid.replace(/^.*?:/g, "");
  }

  const port = parseInt(portStr, 10);
  uuid = decodeURIComponent(uuid);
  name = decodeURIComponent(name);

  const proxy: IProxyConfig = {
    type: "vless",
    name,
    server,
    port,
    uuid,
  };

  const params: Record<string, string> = {};
  for (const addon of addons.split("&")) {
    const [key, valueRaw] = addon.split("=");
    const value = decodeURIComponent(valueRaw);
    params[key] = value;
  }

  proxy.name =
    name ?? params.remarks ?? params.remark ?? `VLESS ${server}:${port}`;

  proxy.tls = (params.security && params.security !== "none") || undefined;
  if (isShadowrocket && /TRUE|1/i.test(params.tls)) {
    proxy.tls = true;
    params.security = params.security ?? "reality";
  }
  proxy.sni = params.sni || params.peer;
  proxy.flow = params.flow ? "xtls-rprx-vision" : undefined;

  proxy["client-fingerprint"] = params.fp as
    | "chrome"
    | "firefox"
    | "safari"
    | "iOS"
    | "android"
    | "edge"
    | "360"
    | "qq"
    | "random";
  proxy.alpn = params.alpn ? params.alpn.split(",") : undefined;
  proxy["skip-cert-verify"] = /(TRUE)|1/i.test(params.allowInsecure);

  if (["reality"].includes(params.security)) {
    const opts: IProxyConfig["reality-opts"] = {};
    if (params.pbk) {
      opts["public-key"] = params.pbk;
    }
    if (params.sid) {
      opts["short-id"] = params.sid;
    }
    if (Object.keys(opts).length > 0) {
      proxy["reality-opts"] = opts;
    }
  }

  let httpupgrade = false;
  proxy.ws = {
    headers: undefined,
    "ws-service-name": undefined,
    path: undefined,
  };
  proxy.http = {
    headers: undefined,
    "http-service-name": undefined,
    path: undefined,
  };
  proxy.grpc = { "_grpc-type": undefined };
  proxy.network = params.type as "ws" | "http" | "h2" | "grpc";
  if (params.headerType === "http") {
    proxy.network = "http";
  } else {
    proxy.network = "ws";
    httpupgrade = true;
  }
  if (!proxy.network && isShadowrocket && params.obfs) {
    proxy.network = params.obfs as "ws" | "http" | "h2" | "grpc";
  }
  if (["websocket"].includes(proxy.network)) {
    proxy.network = "ws";
  }
  if (proxy.network && !["tcp", "none"].includes(proxy.network)) {
    const opts: Record<string, any> = {};
    const host = params.host ?? params.obfsParam;
    if (host) {
      if (params.obfsParam) {
        try {
          const parsed = JSON.parse(host);
          opts.headers = parsed;
        } catch (e) {
          opts.headers = { Host: host };
        }
      } else {
        opts.headers = { Host: host };
      }
    }
    if (params.serviceName) {
      opts[`${proxy.network}-service-name`] = params.serviceName;
    } else if (isShadowrocket && params.path) {
      if (!["ws", "http", "h2"].includes(proxy.network)) {
        opts[`${proxy.network}-service-name`] = params.path;
        delete params.path;
      }
    }
    if (params.path) {
      opts.path = params.path;
    }
    if (["grpc"].includes(proxy.network)) {
      opts["_grpc-type"] = params.mode || "gun";
    }
    if (httpupgrade) {
      opts["v2ray-http-upgrade"] = true;
      opts["v2ray-http-upgrade-fast-open"] = true;
    }
    if (Object.keys(opts).length > 0) {
      proxy[`${proxy.network}-opts`] = opts;
    }
  }

  if (proxy.tls && !proxy.sni) {
    if (proxy.network === "ws") {
      proxy.sni = proxy.ws?.headers?.Host;
    } else if (proxy.network === "http") {
      let httpHost = proxy.http?.headers?.Host;
      proxy.sni = Array.isArray(httpHost) ? httpHost[0] : httpHost;
    }
  }

  return proxy;
}

function URI_Trojan(line: string): IProxyConfig {
  let [newLine, name] = line.split(/#(.+)/, 2);
  const parser = getTrojanURIParser();
  const proxy = parser.parse(newLine);
  if (isNotBlank(name)) {
    try {
      proxy.name = decodeURIComponent(name);
    } catch (e) {
      throw Error("Can not get proxy name");
    }
  }
  return proxy;
}

function URI_Hysteria2(line: string): IProxyConfig {
  line = line.split(/(hysteria2|hy2):\/\//)[2];
  // eslint-disable-next-line no-unused-vars
  let [__, password, server, ___, port, ____, addons = "", name] =
    /^(.*?)@(.*?)(:(\d+))?\/?(\?(.*?))?(?:#(.*?))?$/.exec(line) || [];
  let portNum = parseInt(`${port}`, 10);
  if (isNaN(portNum)) {
    portNum = 443;
  }
  password = decodeURIComponent(password);
  if (name != null) {
    name = decodeURIComponent(name);
  }
  name = name ?? `Hysteria2 ${server}:${port}`;

  const proxy: IProxyConfig = {
    type: "hysteria2",
    name,
    server,
    port: portNum,
    password,
  };

  const params: Record<string, string> = {};
  for (const addon of addons.split("&")) {
    const [key, valueRaw] = addon.split("=");
    let value = valueRaw;
    value = decodeURIComponent(valueRaw);
    params[key] = value;
  }

  proxy.sni = params.sni;
  if (!proxy.sni && params.peer) {
    proxy.sni = params.peer;
  }
  if (params.obfs && params.obfs !== "none") {
    proxy.obfs = params.obfs;
  }

  proxy.ports = params.mport;
  proxy["obfs-password"] = params["obfs-password"];
  proxy["skip-cert-verify"] = /(TRUE)|1/i.test(params.insecure);
  proxy.tfo = /(TRUE)|1/i.test(params.fastopen);
  proxy["tls-fingerprint"] = params.pinSHA256;

  return proxy;
}

function URI_Hysteria(line: string): IProxyConfig {
  line = line.split(/(hysteria|hy):\/\//)[2];
  let [__, server, ___, port, ____, addons = "", name] =
    /^(.*?)(:(\d+))?\/?(\?(.*?))?(?:#(.*?))?$/.exec(line)!;
  let portNum = parseInt(`${port}`, 10);
  if (isNaN(portNum)) {
    portNum = 443;
  }
  if (name != null) {
    name = decodeURIComponent(name);
  }
  name = name ?? `Hysteria ${server}:${port}`;

  const proxy: IProxyConfig = {
    type: "hysteria",
    name,
    server,
    port: portNum,
  };
  const params: Record<string, string> = {};

  for (const addon of addons.split("&")) {
    let [key, value] = addon.split("=");
    key = key.replace(/_/, "-");
    value = decodeURIComponent(value);
    switch (key) {
      case "alpn":
        proxy["alpn"] = value ? value.split(",") : undefined;
        break;
      case "insecure":
        proxy["skip-cert-verify"] = /(TRUE)|1/i.test(value);
        break;
      case "auth":
        proxy["auth-str"] = value;
        break;
      case "mport":
        proxy["ports"] = value;
        break;
      case "obfsParam":
        proxy["obfs"] = value;
        break;
      case "upmbps":
        proxy["up"] = value;
        break;
      case "downmbps":
        proxy["down"] = value;
        break;
      case "obfs":
        proxy["obfs"] = value || "";
        break;
      case "fast-open":
        proxy["fast-open"] = /(TRUE)|1/i.test(value);
        break;
      case "peer":
        proxy["fast-open"] = /(TRUE)|1/i.test(value);
        break;
      case "recv-window-conn":
        proxy["recv-window-conn"] = parseInt(value);
        break;
      case "recv-window":
        proxy["recv-window"] = parseInt(value);
        break;
      case "ca":
        proxy["ca"] = value;
        break;
      case "ca-str":
        proxy["ca-str"] = value;
        break;
      case "disable-mtu-discovery":
        proxy["disable-mtu-discovery"] = /(TRUE)|1/i.test(value);
        break;
      case "fingerprint":
        proxy["fingerprint"] = value;
        break;
      case "protocol":
        proxy["protocol"] = value;
      case "sni":
        proxy["sni"] = value;
      default:
        break;
    }
  }

  if (!proxy.sni && params.peer) {
    proxy.sni = params.peer;
  }
  if (!proxy["fast-open"] && params["fast-open"]) {
    proxy["fast-open"] = true;
  }
  if (!proxy.protocol) {
    proxy.protocol = "udp";
  }

  return proxy;
}

function URI_TUIC(line: string): IProxyConfig {
  line = line.split(/tuic:\/\//)[1];

  let [__, uuid, password, server, ___, port, ____, addons = "", name] =
    /^(.*?):(.*?)@(.*?)(:(\d+))?\/?(\?(.*?))?(?:#(.*?))?$/.exec(line) || [];

  let portNum = parseInt(`${port}`, 10);
  if (isNaN(portNum)) {
    portNum = 443;
  }
  password = decodeURIComponent(password);
  if (name != null) {
    name = decodeURIComponent(name);
  }
  name = name ?? `TUIC ${server}:${port}`;

  const proxy: IProxyConfig = {
    type: "tuic",
    name,
    server,
    port: portNum,
    password,
    uuid,
  };

  for (const addon of addons.split("&")) {
    let [key, value] = addon.split("=");
    key = key.replace(/_/, "-");
    value = decodeURIComponent(value);
    switch (key) {
      case "token":
        proxy["token"] = value;
        break;
      case "ip":
        proxy["ip"] = value;
        break;
      case "heartbeat-interval":
        proxy["heartbeat-interval"] = parseInt(value);
        break;
      case "alpn":
        proxy["alpn"] = value ? value.split(",") : undefined;
        break;
      case "disable-sni":
        proxy["disable-sni"] = /(TRUE)|1/i.test(value);
        break;
      case "reduce-rtt":
        proxy["reduce-rtt"] = /(TRUE)|1/i.test(value);
        break;
      case "request-timeout":
        proxy["request-timeout"] = parseInt(value);
        break;
      case "udp-relay-mode":
        proxy["udp-relay-mode"] = value;
        break;
      case "congestion-controller":
        proxy["congestion-controller"] = value;
        break;
      case "max-udp-relay-packet-size":
        proxy["max-udp-relay-packet-size"] = parseInt(value);
        break;
      case "fast-open":
        proxy["fast-open"] = /(TRUE)|1/i.test(value);
        break;
      case "skip-cert-verify":
        proxy["skip-cert-verify"] = /(TRUE)|1/i.test(value);
        break;
      case "max-open-streams":
        proxy["max-open-streams"] = parseInt(value);
        break;
      case "sni":
        proxy["sni"] = value;
        break;
      case "allow-insecure":
        proxy["skip-cert-verify"] = /(TRUE)|1/i.test(value);
        break;
    }
  }

  return proxy;
}

function URI_Wireguard(line: string): IProxyConfig {
  line = line.split(/(wireguard|wg):\/\//)[2];
  let [__, ___, privateKey, server, ____, port, _____, addons = "", name] =
    /^((.*?)@)?(.*?)(:(\d+))?\/?(\?(.*?))?(?:#(.*?))?$/.exec(line)!;

  let portNum = parseInt(`${port}`, 10);
  if (isNaN(portNum)) {
    portNum = 443;
  }
  privateKey = decodeURIComponent(privateKey);
  if (name != null) {
    name = decodeURIComponent(name);
  }
  name = name ?? `WireGuard ${server}:${port}`;
  const proxy: IProxyConfig = {
    type: "wireguard",
    name,
    server,
    port: portNum,
    "private-key": privateKey,
    udp: true,
  };
  for (const addon of addons.split("&")) {
    let [key, value] = addon.split("=");
    key = key.replace(/_/, "-");
    value = decodeURIComponent(value);
    switch (key) {
      case "address":
      case "ip":
        value.split(",").map((i) => {
          const ip = i
            .trim()
            .replace(/\/\d+$/, "")
            .replace(/^\[/, "")
            .replace(/\]$/, "");
          if (isIPv4(ip)) {
            proxy.ip = ip;
          } else if (isIPv6(ip)) {
            proxy.ipv6 = ip;
          }
        });
        break;
      case "publickey":
        proxy["public-key"] = value;
        break;
      case "allowed-ips":
        proxy["allowed-ips"] = value.split(",");
        break;
      case "pre-shared-key":
        proxy["pre-shared-key"] = value;
        break;
      case "reserved":
        const parsed = value
          .split(",")
          .map((i) => parseInt(i.trim(), 10))
          .filter((i) => Number.isInteger(i));
        if (parsed.length === 3) {
          proxy["reserved"] = parsed;
        }
        break;
      case "udp":
        proxy["udp"] = /(TRUE)|1/i.test(value);
        break;
      case "mtu":
        proxy.mtu = parseInt(value.trim(), 10);
        break;
      case "dialer-proxy":
        proxy["dialer-proxy"] = value;
        break;
      case "remote-dns-resolve":
        proxy["remote-dns-resolve"] = /(TRUE)|1/i.test(value);
        break;
      case "dns":
        proxy.dns = value.split(",");
        break;
      default:
        break;
    }
  }

  return proxy;
}

function URI_HTTP(line: string): IProxyConfig {
  line = line.split(/(http|https):\/\//)[2];
  let [__, ___, auth, server, ____, port, _____, addons = "", name] =
    /^((.*?)@)?(.*?)(:(\d+))?\/?(\?(.*?))?(?:#(.*?))?$/.exec(line)!;

  let portNum = parseInt(`${port}`, 10);
  if (isNaN(portNum)) {
    portNum = 443;
  }
  if (auth) {
    auth = decodeURIComponent(auth);
  }
  if (name != null) {
    name = decodeURIComponent(name);
  }
  name = name ?? `HTTP ${server}:${portNum}`;
  const proxy: IProxyConfig = {
    type: "http",
    name,
    server,
    port: portNum,
  };
  if (auth) {
    const [username, password] = auth.split(":");
    proxy.username = username;
    proxy.password = password;
  }

  for (const addon of addons.split("&")) {
    let [key, value] = addon.split("=");
    key = key.replace(/_/, "-");
    value = decodeURIComponent(value);
    switch (key) {
      case "tls":
        proxy.tls = /(TRUE)|1/i.test(value);
        break;
      case "fingerprint":
        proxy["fingerprint"] = value;
        break;
      case "skip-cert-verify":
        proxy["skip-cert-verify"] = /(TRUE)|1/i.test(value);
        break;
      case "udp":
        proxy["udp"] = /(TRUE)|1/i.test(value);
        break;
      case "ip-version":
        proxy["ip-version"] = value;
        break;
      default:
        break;
    }
  }

  return proxy;
}

function URI_SOCKS(line: string): IProxyConfig {
  line = line.split(/socks5:\/\//)[1];
  let [__, ___, auth, server, ____, port, _____, addons = "", name] =
    /^((.*?)@)?(.*?)(:(\d+))?\/?(\?(.*?))?(?:#(.*?))?$/.exec(line)!;

  let portNum = parseInt(`${port}`, 10);
  if (isNaN(portNum)) {
    portNum = 443;
  }
  if (auth) {
    auth = decodeURIComponent(auth);
  }
  if (name != null) {
    name = decodeURIComponent(name);
  }
  name = name ?? `SOCKS5 ${server}:${portNum}`;
  const proxy: IProxyConfig = {
    type: "socks5",
    name,
    server,
    port: portNum,
  };
  if (auth) {
    const [username, password] = auth.split(":");
    proxy.username = username;
    proxy.password = password;
  }

  for (const addon of addons.split("&")) {
    let [key, value] = addon.split("=");
    key = key.replace(/_/, "-");
    value = decodeURIComponent(value);
    switch (key) {
      case "tls":
        proxy.tls = /(TRUE)|1/i.test(value);
        break;
      case "fingerprint":
        proxy["fingerprint"] = value;
        break;
      case "skip-cert-verify":
        proxy["skip-cert-verify"] = /(TRUE)|1/i.test(value);
        break;
      case "udp":
        proxy["udp"] = /(TRUE)|1/i.test(value);
        break;
      case "ip-version":
        proxy["ip-version"] = value;
        break;
      default:
        break;
    }
  }

  return proxy;
}
