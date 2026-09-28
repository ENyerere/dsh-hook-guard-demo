# dsh-hook-guard-demo

`dsh-hooks-bus` 的**被依赖路径验证插件**：一个完全独立的包，声明 `dsh-hooks-bus` 为依赖，通过**声明式清单**订阅 `PreToolUse`，拦截危险 shell 命令。

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
| `rm -rf …`（含变体 `rm -fr`） | block |
| `format C:` | block |
| `del /s …`、`del /q …` | block |
| `git push … --force` | block |
| `shutdown /s`、`shutdown /r` | block |
| 其余命令 | 放行 |

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
