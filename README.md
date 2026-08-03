# Headers

用于 Chromium 浏览器的 Request Header 管理扩展。它面向本地开发和联调场景，可以在多个环境空间之间切换，并覆盖当前空间中已勾选的 Header。

## 功能

- 全局启用或暂停 Header 覆盖。
- 环境空间使用浏览器式标签切换；点击 `+` 后直接输入名称并按回车创建，点击标签上的 `×` 删除。
- 每条 Header 独立启用；勾选后覆盖，不勾选则不处理。
- 支持预定义 Header Key，也可以手动输入；配置直接在插件内打开。
- 全局忽略请求目标域名，支持 `*` 通配符：
  - `example.com` 仅匹配该域名。
  - `*.example.com` 匹配其子域名。
  - `api-*.example.com` 匹配域名片段。
- 支持跟随系统、浅色和深色主题。
- 支持简体中文和英文，默认跟随 Chromium 的界面语言，其他语言回退英文。
- 默认字体为 `ComicShannsMono Nerd Font, Hannotate SC`，可在插件内配置中修改。

## 本地加载

1. 打开 `chrome://extensions` 或 Chromium 浏览器对应的扩展管理页。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本目录 `headers`。

扩展需要访问所有网站，才能对目标请求应用 Header。配置只保存在当前浏览器的 `chrome.storage.local` 中，不会上传或同步。
