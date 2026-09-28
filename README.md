# dsh-hook-guard-demo

[dsh-hooks-bus](https://github.com/ENyerere/dsh-hooks-bus) 的**被依赖路径验证插件**：一个完全独立的包，声明 `dsh-hooks-bus` 为依赖，通过**声明式清单**订阅 `PreToolUse`，拦截危险 shell 命令。

> 想写自己的总线消费者插件？照抄本仓库 10 分钟即可跑通；更完整的对接文档见总线的 [author-guide](https://github.com/ENyerere/dsh-hooks-bus/blob/main/docs/author-guide.md)。

## 工作机制

1. `package.json` 声明依赖与清单：

```json
{
  "peerDependencies": { "dsh-hooks-bus": ">=0.2.0" },
  "hooksBus": {
    "subscriptions": [
      { "event": "PreToolUse", "priority": 100, "timeoutMs": 2000,
        "label": "dsh-hook-guard-demo", "handler": "./hooks/danger-guard.js" }
    ]
  }
}
```

2. 插件入口声明硬依赖 `inject: ['hooksBus']`——总线未启用时 Loader 明确报错；
3. `apply` 读取自己的清单并 `await ctx.hooksBus.declare(entries, { baseUrl })`，总线动态 import `hooks/danger-guard.js`（default export）完成注册。

## 拦截规则

| 命令 | 结果 |
| --- | --- |
| `rm` 递归+强制删除（`-rf` / `-fr` / `-Rf` / `-r -f` / `--recursive --force` 任意拼写） | block |
| `Remove-Item … -Recurse`（PowerShell 原生递归删除） | block |
| `rd /s …`、`rmdir /s …`（cmd 递归删除） | block |
| `del /s …`、`del /q …` | block |
| `format C:` | block |
| `git push … --force` | block |
| `shutdown /s`、`shutdown /r` | block |
| 其余命令（含 `rm -f 单文件`、`rm -r` 不带 `-f`、`Remove-Item` 无 `-Recurse`） | 放行 |

> 定位说明：本插件是**演示**，字符串匹配不是安全边界——覆盖常见危险写法，但不防御刻意混淆。

## 验证

- `tests/guard.test.ts`：真实挂载 dsh-hooks-bus + 本插件，经 `tools/pre-execute` waterfall 断言危险命令得到官方 `deny`、安全命令得到 `allow`；未装总线时给出明确错误。
- 安装进 profile 后，运行 `rm -rf /tmp/x` 观察工具调用被 deny（reason 进入模型可见文本）。

## 开发

```sh
pnpm install
pnpm test
pnpm build
pnpm typecheck
pnpm lint
```

MIT
