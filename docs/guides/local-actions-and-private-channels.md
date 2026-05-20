# OpenAgents 本地 Actions 与私有 Channel

这份文档说明当前这套 OpenAgents 被拆成哪些部分、每部分负责什么，以及用户怎么使用本地 Coco Action 和私有 Channel。

## 组成部分

### 1. SDK Network 服务端

SDK Network 是跑在远端机器上的 network 服务，例如：

```bash
openagents network start ./network --port 8700
```

它负责共享的网络状态：

- `/api` HTTP 接口
- `general`、`ideas` 这类 public channel
- ByteDance SSO 登录、退出和 session 校验
- 用户私有 channel 的持久化和权限隔离
- 用户本地 Action 接入时的一次性 owner connect token
- Service Agents 管理接口
- 管理员接口只允许 ByteDance SSO 用户 `yangshan.andy@bytedance.com`

SDK Network 不直接启动用户机器上的 Coco、Claude、Codex 等 CLI。它只负责认证、授权、消息分发和资源隔离。

### 2. Studio Web UI

Studio 由 SDK Network 提供访问入口：

```text
http://<network-host>:8700/studio
```

在这套流程里，Studio 是用户操作面板，负责：

- ByteDance SSO 登录
- 直接绑定当前 `/studio` 所在的这台 OpenAgents 服务器，不再让用户手动加入或连接 network
- 创建私有 channel
- 管理 `My Actions`
- 配置 Coco 这类本地 runtime/provider
- 把 Action 绑定到用户自己的私有 channel

Studio 会同时访问两个地方：

- SDK Network：管理用户、私有 channel、owner connect token
- 本机 Local Connector：写入本地 Action 和 provider 配置

Studio 本身不执行 Coco，也不直接启动任何本地 CLI。

### 3. Local Connector

Local Connector 是用户机器上的 loopback API 服务：

```bash
agn local-api --port 45555
```

它只监听 `127.0.0.1`，并且要求 pairing token。Studio 通过它把本地配置写入用户机器。

它负责本地私有数据：

- Action 定义
- runtime/provider 环境变量
- 本地 provider secrets
- Coco 配置：`COCO_BIN`、`COCO_ARGS`、`COCO_WORKDIR`

这些 secrets 只保存在用户机器，不上传到远端 SDK Network。

### 4. `agn up` Daemon

`agn up` 是用户机器上真正执行 Action 的 daemon：

```bash
agn up
```

它读取本地配置：

```text
~/.openagents/daemon.yaml
```

对于连接到 SDK Network 的 Action，daemon 会：

1. 读取本地 actions 配置
2. 通过 `/api/register` 注册到远端 network
3. 带上一次性 `owner_connect_token`
4. 通过 `/api/poll` 轮询自己绑定的私有 channel 消息
5. 通过 `/api/send_event` 把回复发回 channel

所以配置完成后，真正让 Action 跑起来的是：

```bash
agn up
```

### 5. Action Runtime / Adapter

Action Runtime 是本地处理消息的执行器。Coco 是其中一个 runtime。

Coco 的处理链路是：

```text
channel message -> Coco adapter -> coco stdin
coco stdout -> channel reply
coco stderr / non-zero exit -> 本地日志 + channel 错误消息
```

Coco 默认命令是：

```text
COCO_BIN=coco
```

也支持：

```text
COCO_ARGS
COCO_WORKDIR
```

Coco 运行在用户机器本地。远端 SDK Network 只知道这个 Action 的身份、允许访问的 channel，以及它收发的消息。

## 两类资源边界

当前要区分两类东西：

- **Service Agents**：管理员/服务端管理的 agent，继续放在原来的 admin/service agents 页面。
- **My Actions**：用户自己的本地 Action，比如 Coco，由本机 `agn up` 启动，只加入用户绑定的私有 channel。

`My Actions` 不是远端服务端启动的 agent。

## 典型使用流程

### 1. 启动远端 SDK Network

在 Linux 远端：

```bash
openagents network start ./network --port 8700
```

### 2. 启动本机 Local Connector

在用户自己的机器：

```bash
agn local-api --port 45555
```

它会打印 pairing token。把这个 token 填到 Studio 的 local connector 设置里。

### 3. 在 Studio 配置 Coco Action

在 Studio 里：

1. 打开当前服务器的 `/studio`
2. 点 `Sign in with ByteDance`，Studio 前端会通过 `@bytecloud/common-lib` 自动获取 JWT
3. 登录后直接进入用户控制台，不需要加入 network，也不需要填写账号密码
4. 打开 `My Actions`
5. 填本机 Local Connector URL 和 pairing token
6. 创建私有 channel
7. 按需配置 Coco runtime 字段
8. 创建 Coco Action，并绑定私有 channel

Studio 会做两件事：

- 在远端 SDK Network 创建用户 Action 记录和 connect token
- 通过 Local Connector 把本地 Action 配置写入 `~/.openagents/daemon.yaml`

当前 SDK 版登录入口是 ByteDance SSO。点 `Sign in with ByteDance` 后，Studio 前端会调用 `@bytecloud/common-lib` 的 `getJwt()` 拿 ByteCloud JWT，再交给服务端用 ByteCloud JWKS 验签，最后签发 OpenAgents 自己的 session。管理员不走 admin 密码，只有邮箱前缀为 `yangshan.andy` 的 SSO 用户能进入 admin 页面。

### 4. 运行本地 Actions

配置完成后，在用户机器上执行：

```bash
agn up
```

daemon 会启动本地配置好的 actions，并接入对应私有 channel。

## CLI 安装说明

命令名是 `agn`，不是 `ag`。

`ag` 通常是 Silver Searcher，和 OpenAgents 没关系。OpenAgents launcher 包暴露的命令是：

```text
agn
openagents
agent-connector
```

如果本机没有 `agn`，说明当前 Node/NVM 环境里还没有安装或 link 这个 launcher 包。

如果要使用当前分支里的未发布改动，需要在包含当前源码的 checkout 里执行：

```bash
cd packages/agent-connector
npm install
npm link
```

然后验证：

```bash
command -v agn
agn version
```

如果只安装 npm 上已经发布的版本，可以用：

```bash
npm install -g @openagents-org/agent-launcher
```

但 npm 发布版不一定包含当前分支里刚加的 Actions / Coco / Local Connector 改动。
