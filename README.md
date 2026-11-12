# dsh-dated-workspace · 日期-会话简称 工作区文件夹

在**你指定的那个工作区**里，每开一个新会话，自动建一个 `日期-会话简称` 文件夹，并把该会话的工作目录切进去 —— 这次会话按相对路径写出的一切都落在这个文件夹里，不再堆在工作区根目录。

工作区是**设置项**，不是猜的：只有 `cwd` 等于该路径的新会话会被处理，其它工作区、子代理、已经有自己工作目录的会话一律不动。

```
F:\my-workspace\
├─ 2026-11-12-重构认证模块\      ← 会话简称取自标题，最多 6 个字
│  ├─ auth.py
│  └─ test_auth.py
├─ 2026-11-12-登录页闪退排\
└─ 项目源码\                     ← 你原有的内容，插件不碰
```

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
| **简称字数** | `{title}` 保留几个字，默认 **6**。中文按字切，英文按整词切（`Refactor the auth module` → `Refactor`）。 |
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
    collision: suffix
    createMode: immediate
```

所有字段都是 `.volatile()`，改完即时生效。

## 命名规则

1. **建夹时**用当时能拿到的名字：已生成的会话标题 → 首条消息正文 → 会话 id 尾段。
2. **标题生成后**（DSH 首轮结束会起名）自动把文件夹改名成 `日期-简称`，工作目录跟着换。
3. 改名只发生在**轮次之间**（`turn/end`）：Windows 上运行中的工具会占住目录，中途改名既会失败也会作废模型已经打印出去的路径。
4. 所以刚开的新会话可能先叫 `2026-11-12-帮我检查这个`，几秒后变成 `2026-11-12-登录页闪退排` —— 这是预期行为，不是 bug。

简称的清洗：去掉 Markdown 前缀（`#`、`- `、`1. `）、`标题：` 这类前缀、首尾标点，保留首尾都不会是标点的干净词；中文按字切 6 个，英文优先整词（单词超长时保留整词，超过 12 字符才硬切）。

## 行为边界

- **只影响新会话**：`agent/created`（打开时创建）或首条消息的第一次 `agent/pre-step`（首条消息时创建），每条会话只分配一次文件夹。
- **不改工作区归属**：侧边栏里会话仍属于原工作区，只是**有效工作目录**变了（走 `ctx.workingDirectory.set()`，DSH 会持久化并在重启后重放）。
- **重启可恢复**：受管文件夹里有 `.dsh-dated-workspace.json` 归属标记，重启后靠它认领原文件夹，并继续支持后续改名，不会给同一条会话建第二个夹。
- **旧会话不动**：已有 `assistant/message` / `tool/call` / `turn/end` 的会话不会被搬到新夹里，避免把它此前写过的东西散到两个根下。
- **只管相对路径**：工具里写死的绝对路径不会被拦截或搬移。
- **会话日志不进文件夹**：DSH 的日志仍在 `~/.dsh/sessions`；进文件夹的是这次会话**写出来的文件**。

## License

MIT
