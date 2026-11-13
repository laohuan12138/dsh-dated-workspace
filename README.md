# dsh-dated-workspace · 日期-会话简称 工作区文件夹

在**你指定的那个工作区**里，每开一个新会话，自动建一个 `日期-会话简称` 文件夹，并把该会话的工作目录切进去 —— 这次会话按相对路径写出的一切都落在这个文件夹里，不再堆在工作区根目录。

工作区是**设置项**，不是猜的：只有 `cwd` 等于该路径的新会话会被处理，其它工作区、子代理、已经有自己工作目录的会话一律不动。

```
F:\my-workspace\
├─ 2026-11-12-登录页闪退排查\         ← 模型读完会话后浓缩，最多 15 个字
│  ├─ auth.py
│  └─ test_auth.py
├─ 2026-11-13-SMB 与 WMI 连通性排查\
└─ 项目源码\                         ← 你原有的内容，插件不碰
```

## 简称是 AI 浓缩的，不是截取的

默认 `summaryMode: ai`：会话开起来之后，插件把**你的第一句话 + 最新一条助手回复 + 之后的几条用户消息**发给当前默认模型，要求它概括这次会话真正在做的主题。

```
排查一下 2026-11-13 这台机器 SMB 和 WMI 连不上，共享盘挂载失败
   ↓ 标题截取（旧行为）              ↓ AI 浓缩（默认，上限 15 字）
排查一下 2026-11-13 这台机器的      SMB 与 WMI 连通性排查失败
```

**AI 浓缩有自己独立的字数上限**：`summaryChars`，默认 **15**，与「简称字数」（截取上限，默认 6）互不干扰。想改宽改窄只改这一项，切回截取时也不受影响。

模型调用与主对话**完全并行**，不进入对话历史，也不占用你这次会话的响应时间：

1. 文件夹先按当下能拿到的名字建好（首条消息 / 会话 id 尾段），会话立刻有地方写文件。
2. 浓缩请求在后台发出，使用模型提供的**最低推理强度**，`maxTokens` 512，硬超时默认 25 秒。
3. 名字回来后，在**轮次之间**（`turn/end`）把文件夹改名，工作目录跟着换。
4. 模型不可用、provider 报错、超时、返回「未命名」——一律退回标题截取，只写一条 warn 日志（缺 llm 服务或缺默认模型时只报一次），绝不耽误建文件夹。

想恢复成纯截取，把「简称来源」切成 `标题截取`（`summaryMode: slice`）即可，此时不会发生任何模型调用。

> **升级一定要看**：插件是按 git tag 装的，`v1.0.0` 是只有截取逻辑的旧版。如果你更新完仍然看到截取的名字，先确认装的是哪一版：
>
> ```powershell
> Select-String -Path "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-dated-workspace\index.js" -Pattern 'summaryMode' -Quiet   # True 才是新版
> ```
>
> 装新版（打完 tag 后）：
>
> ```powershell
> dsh plugin --profile desktop add github:laohuan12138/dsh-dated-workspace#v1.2.0
> ```
>
> 然后**彻底重启 DSH**。只覆盖文件不重启，Host 侧跑的仍是旧代码。

## 安装 / 更新

```powershell
dsh plugin --profile desktop add github:laohuan12138/dsh-dated-workspace
```

装完彻底重启 DSH（不是关窗口），再刷新页面。卸载：

```powershell
dsh plugin --profile desktop remove dsh-dated-workspace
```

已创建的文件夹与会话都保留。

## 配置

### 插件详情页（推荐）

**插件 → 已安装 → 按日期命名的工作区文件夹**：

| 控件 | 作用 |
|---|---|
| **生效的工作区** | 「选择文件夹…」调系统目录选择器。留空 = DSH 默认工作区。 |
| **文件夹名模板** | 默认 `{date}-{title}`。可用 `{date}`（`2026-11-12`）、`{title}`（会话简称）、`{time}`、`{session}`（会话 id 尾段），用 `/` 可建多级目录。 |
| **简称字数** | 截取模式下 `{title}` 保留几个字，默认 **6**。AI 模式下由「浓缩字数」决定。 |
| **简称来源** | `AI 浓缩`（默认）让模型概括主题；`标题截取` 直接切标题前几个字，不发模型请求。 |
| **浓缩字数** | AI 浓缩的名字上限，默认 **15**。只影响 AI 模式，与「简称字数」互不干扰。 |
| **浓缩用的模型** | 两行输入：上一行 provider、下一行模型 id。都留空 = 跟随当前默认模型；要单独指定就两行一起填。 |
| **浓缩超时** | 单次浓缩的硬超时，默认 25000 毫秒，超时即用截取的名字。 |
| **同名文件夹** | `追加 -2、-3`（默认，一会话一夹）/ `复用同一个`（同名的会话共用一个夹）。 |
| **创建时机** | `打开会话时创建`（默认）/ `首条消息时创建`。 |

模板下方有实时示例，直接显示按当前模板会生成什么名字。

### `cordis.patch.yml`

`<DSH_HOME>\profiles\<profile>\cordis.patch.yml` 末尾（整段替换该行 config）：

```yaml
- id: dated-workspace
  name: dsh-dated-workspace
  config:
    enabled: true
    workspace: 'F:\my-workspace'
    folderName: '{date}-{title}'
    titleChars: 6
    summaryMode: ai
    summaryChars: 15
    summaryProvider: ''
    summaryModel: ''
    summaryTimeoutMs: 25000
    collision: suffix
    createMode: immediate
```

所有字段都是 `.volatile()`，改完即时生效。

## 命名规则

1. **建夹时**用当时能拿到的名字：已生成的会话标题 → 首条消息正文 → 会话 id 尾段。
2. **同时**把会话片段发给模型浓缩；名字回来后在轮次之间把文件夹改名成 `日期-简称`，工作目录跟着换。
3. 改名只发生在**轮次之间**（`turn/end`）：Windows 上运行中的工具会占住目录，中途改名既会失败也会作废模型已经打印出去的路径。
4. 所以刚开的新会话可能先叫 `2026-11-12-帮我看看登录`，几秒后变成 `2026-11-12-登录页闪退排查` —— 这是预期行为，不是 bug。
5. 一条会话只浓缩一次：换个话题不会把文件夹改成别的主题，失败也不无限重试（最多 3 次）。

简称的清洗（两道）：模型输出先去掉 Markdown 前缀、引号、首尾标点、`文件夹名：` 这类前缀，再按字数收口（中文按字、英文优先整词，超长才硬切）；落盘前还会过一次文件系统非法字符替换。万一模型给了超长名字，最终一定不超过「浓缩字数」。

## 行为边界

- **只影响新会话**：`agent/created`（打开时创建）或首条消息的第一次 `agent/pre-step`（首条消息时创建），每条会话只分配一次文件夹。
- **不改工作区归属**：侧边栏里会话仍属于原工作区，只是**有效工作目录**变了（走 `ctx.workingDirectory.set()`，DSH 会持久化并在重启后重放）。
- **重启可恢复**：受管文件夹里有 `.dsh-dated-workspace.json` 归属标记，重启后靠它认领原文件夹，并继续支持后续改名，不会给同一条会话建第二个夹；认领回来的夹子不会被重新浓缩成另一个名字。
- **旧会话不动**：已有 `assistant/message` / `tool/call` / `turn/end` 的会话不会被搬到新夹里，避免把它此前写过的东西散到两个根下。
- **只管相对路径**：工具里写死的绝对路径不会被拦截或搬移。
- **会话日志不进文件夹**：DSH 的日志仍在 `~/.dsh/sessions`；进文件夹的是这次会话**写出来的文件**。
- **不泄露会话内容**：浓缩只发首条用户消息与最新一条助手文本（合计上限 4000 字符），不走 `session/title-llm-request`，不写入会话日志。

## 自测

```powershell
npm test    # = names + plugin + prepared-call + client-smoke + wiring 五个套件
```

单跑某一个：

```powershell
node test\names.test.mjs          # 简称清洗与模板拼装
node test\plugin.test.mjs         # 建夹/改名/降级/只影响目标工作区（模拟 Host）
node test\prepared-call.test.mjs  # 复刻 Host 的 prepared.stream 配置一致性契约
node test\client-smoke.mjs        # 设置卡渲染（模拟 React）
node test\wiring.test.mjs         # 关键接线断言（schema 字段、默认值、提示词要求）
```

## 排查"名字还是截取的"

Host 的 console 在应用窗口里看不见，所以每次浓缩都会写一行到：

```
%TEMP%\dsh-dated-workspace.log
```

```powershell
Get-Content "$env:TEMP\dsh-dated-workspace.log" -Tail 20
```

正常一次会是这样：

```
... summary:start  {"session":"abc","route":"new-api/deepseek-v4.1-flash","budget":15,"chars":812,"attempt":1}
... summary:answer {"session":"abc","raw":"「SMB 与 WMI 连通性排查」","name":"SMB 与 WMI 连通性排查"}
... rename         {"session":"abc","to":"2026-11-13-SMB 与 WMI 连通性排查","summary":"SMB 与 WMI 连通性排查"}
```

对照表：

| 日志里看到 | 说明 |
|---|---|
| 一条都没有 | 跑的是旧版代码（没有 `summaryMode`），或 `summaryMode: slice` |
| `当前 Host 没有可用的 llm 服务` | Host 没挂 `llm`，只能截取 |
| `没有可用的默认模型` | provider/model 没配，或 `summaryProvider`/`summaryModel` 只填了一个 |
| `summary:answer` 但 `name` 被截 | 模型给的名字量化后仍超长，检查「浓缩字数」 |
| `生成会话简称失败…` | provider 报错/超时，日志里有原始错误 |

## License

MIT
