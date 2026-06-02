# The following only includes the "Titleraw" tutorial (the file name is misspelled)




# MC基岩版 titleraw & rawtext %%条件本地化完整教程
# MC Bedrock Edition titleraw & rawtext %% Conditional Localization Complete Tutorial

> 配套生成器使用文档｜适配基岩1.21全版本｜微软官方参考
> Generator Documentation | Compatible with Bedrock 1.21+ | Official Reference:
> https://learn.microsoft.com/en-us/minecraft/creator/reference/content/rawmessagejson

---

## 一、类型区分（生成器5大组件）
## I. Type Distinction (5 Generator Components)

### 1. 普通文本 text / Plain Text (`text`)
固定彩色文字，支持§颜色代码、\n换行，永远正常显示。
JSON格式：`{"text":"§6测试文字\n第二行"}`

Static colored text, supports `§` color codes and `\n` line breaks, always displays normally.
JSON Format: `{"text":"§6Test Text\nSecond Line"}`

### 2. 纯计分板 score / Pure Scoreboard (`score`)
只展示数字，无自定义文字；格式：玩家|计分名。
JSON格式：`{"score":{"name":"@s","objective":"金币"}}`

Displays only numeric values, no custom text; Format: Player|Objective.
JSON Format: `{"score":{"name":"@s","objective":"coins"}}`

### 3. 实体选择器 selector / Entity Selector (`selector`)
填入选择器，找到实体显示名称，找不到内容为空、对应%%消失。
JSON格式：`{"selector":"@e[type=cow,r=5]"}`

Fill in a selector expression; displays the entity's name tag when matched. If no target is found, the content is empty and the corresponding %% placeholder disappears.
JSON Format: `{"selector":"@e[type=cow,r=5]"}`

### 4. 原版本地化 translate_origin / Vanilla Localization (`translate_origin`)
填写游戏原版Key，跟随客户端系统语言自动切换中英日韩，不支持%%占位。
with参数仅英文逗号分隔普通文本，不可嵌套计分/选择器。

Fill in the vanilla translation key; automatically switches between CN/EN/JP/KR based on client system language. **Does NOT support** %% placeholders.
The `with` parameter only supports plain text separated by English commas; nesting scores or selectors is not allowed.

### 5. %%条件本地化 translate_cond【核心】/ %% Conditional Localization (`translate_cond`) [Core Feature]
自定义文案+%%1~%%9占位，with数组5种组件自由组合；
规则：%%N = with列表第N项内容，with项为空则对应%%空白，实现条件隐藏/切换。

Custom copy + %%1~%%9 placeholders; the `with` array supports free combination of 5 component types.
Rule: %%N corresponds to the Nth item in the `with` list. If a `with` item is empty, the corresponding %% renders as blank, enabling conditional hide/switch effects.

---

## 二、with五种填写规范（条件本地化专用）
## II. `with` Parameter Specifications (Conditional Localization Only)

| 类型 / Type | 填写格式 / Format | 示例 / Example |
|----|----|----|
| ①普通文本 / Plain Text | 直接写内容 / Direct content | §a达标奖励 / §aReward Unlocked |
| ②纯计分 / Pure Score | 玩家\|计分名 / Player\|Objective | @s\|金币 / @s\|coins |
| ③选择器 / Selector | 选择器表达式 / Selector expression | @e[type=sheep,r=8] |
| ④带计分文本 / Text with Score | 文字\|玩家\|计分名 / Text\|Player\|Objective | §c不足\|@s\|金币 / §cInsufficient\|@s\|coins |
| ⑤嵌套Translate / Nested Translate | 原版key\|参数1,参数2 / Vanilla Key\|Param1,Param2 | item.apple.name |

> ⚠️ 分隔符必须使用英文竖线 | ，禁止中文全角符号。
> ⚠️ Delimiters must use the English vertical bar | . Chinese full-width symbols are strictly prohibited.

---

## 三、三大实战案例
## III. Practical Use Cases

### 案例1：分数达标绿字、不足红字互斥
### Case 1: Score Threshold Color Switch (Mutually Exclusive Green/Red Text)
- 文案 / Copy: 状态 / Status: %%1%%2
- with1：§a金币充足|@s|金币 / §aCoins Sufficient|@s|coins
- with2：§c金币不足|@s|金币 / §cCoins Insufficient|@s|coins
- 逻辑：金币>0显示绿字，=0红字显示，两者互斥。
- Logic: Displays green text when coins > 0; displays red text when coins = 0. Mutually exclusive.

### 案例2：附近有牛才展示，无牛整行隐藏
### Case 2: Entity Presence Check (Show if Cow Exists, Hide Entire Line if None)
- 文案 / Copy: 附近生物 / Nearby Mobs: %%1
- with：@e[type=cow,r=6]
- 逻辑：无牛时%%1空白，整行文字消失。
- Logic: When no cow is in range, %%1 resolves to blank, making the entire line visually disappear.

### 案例3：原版本地化+条件混用
### Case 3: Vanilla Localization + Conditional Mix
rawtext分段拼接 / Rawtext segment concatenation:
```json
[
  {"text":"奖品 / Prize: "},
  {"translate":"item.diamond.name"},
  {"translate":"剩余 / Remaining %%1 金币 / coins","with":[{"score":{"name":"@s","objective":"金币 / coins"}}]}
]
```

---

## 四、混用规则
## IV. Mixing Rules

1. 同一条rawtext数组可以任意穿插：text/score/selector/原版本地化/%%条件本地化。
   A single `rawtext` array can freely interleave: text / score / selector / vanilla translate / %% conditional translate.
2. 单个translate组件只能二选一：原版key 或 自定义%%文案，不能混写。
   A single `translate` component must choose one: **Vanilla Key** OR **Custom %% Copy**. They cannot be mixed.
3. %%仅在【%%条件本地化】生效，原版本地化无法识别%%。
   %% placeholders only work in **[%% Conditional Localization]** mode; vanilla localization cannot recognize %%.

---

## 五、避坑说明
## V. Pitfalls & Warnings

1. §颜色只能写在text内容内，score/selector本体不能加颜色。
   `§` color codes can only be written inside `text` content; `score` / `selector` entities do not support direct color codes.
2. with分隔符为英文|，禁止中文全角符号。
   The `with` delimiter must be the English `|`; Chinese full-width `｜` is strictly prohibited.
3. %%最多1~9，超过9无法识别。
   %% index range is **1~9**; indices above 9 cannot be parsed.
4. * 作为玩家名 = 观看者自身（全服统一动态标题）。
   `*` as a player name = Viewer Self, suitable for server-wide unified dynamic titles.

---

## 六、官方参考
## VI. Official Reference

微软RAW JSON权威文档 / Microsoft Raw JSON Message Documentation:
🔗 https://learn.microsoft.com/en-us/minecraft/creator/reference/content/rawmessagejson
