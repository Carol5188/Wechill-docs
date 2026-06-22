import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/xinyintiaodong/Downloads/5月绩效考核表-产品于涵.xlsx";
const outputDir = "/Users/xinyintiaodong/Documents/幸运礼物/outputs/performance_may_yuhan";
const outputPath = `${outputDir}/5月绩效考核表-产品于涵-已填.xlsx`;

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("绩效考核表");

const completionNotes = [
  [
    "数据：5月对齐三方游戏、幸运礼物、红包风控、主播小号风控、预支/借支扣除等需求，评审问题均及时响应。\n完成：关键节点主动同步；风险和变更提前写入PRD并同步影响范围。",
  ],
  [
    "数据：本月未出现无故缺勤；请假/调休按流程沟通并完成交接。\n完成：离岗前同步待办和交接人，未影响需求评审与推进。",
  ],
  [
    "数据：完成三方游戏接入PRD v1.5、游戏房PRD v1.0、主播小号风控PRD v1.2、预支/借支扣除PRD、幸运礼物方案、红包风控梳理；输出16张游戏房原型拆解图。\n完成：补齐流程、权限、后台、结算、埋点、异常边界和风控阈值，形成8类关键裁决。",
  ],
  [
    "数据：三方游戏从基础方案迭代到v1.5，明确V1范围、Private room、最小化、观战/再来一局、H5超时、扣费退款、配置快照和风控阈值。\n完成：拆解客户端/服务端/后台/测试交付点，需求方向无重大变更。",
  ],
  [
    "数据：三方游戏与幸运礼物/红包处于上线/灰度准备，已定义入口点击率≥15%、加载成功率≥95%、开局成功率≥90%、完成率≥90%、结算失败率≤0.5%。\n完成：补齐埋点验收、风控与成本控制方案，灰度后按看板复盘。",
  ],
  [
    "数据：处理评审/运营/测试反馈，补齐最小化/观战、房主退出、Play Again、H5白屏、扣费失败退款、红包自抢/并发/机器人/退款套利等问题。\n完成：P0/P1问题优先闭环，暂未记录重大线上投诉。",
  ],
];

const targetCompletion = [[1], [1], [1], [0.95], [0.9], [1]];
const selfScores = [[96], [100], [96], [94], [90], [95]];
const blankSupervisorScores = [[null], [null], [null], [null], [null], [null]];
const weightedScoreFormulas = [4, 5, 6, 7, 8, 9].map((row) => [
  `=C${row}*H${row}*IF(J${row}="",I${row},I${row}*20%+J${row}*80%)`,
]);

sheet.getRange("G4:G9").values = completionNotes;
sheet.getRange("H4:H9").values = targetCompletion;
sheet.getRange("I4:I9").values = selfScores;
sheet.getRange("J4:J9").values = blankSupervisorScores;
sheet.getRange("K4:K9").formulas = weightedScoreFormulas;

sheet.getRange("C10").formulas = [["=SUM(C4:C9)"]];
sheet.getRange("H10").formulas = [["=SUMPRODUCT(C4:C9,H4:H9)"]];
sheet.getRange("I10").formulas = [["=SUMPRODUCT(C4:C9,I4:I9)"]];
sheet.getRange("J10").formulas = [['=IF(COUNT(J4:J9)=0,"",SUMPRODUCT(C4:C9,J4:J9))']];
sheet.getRange("K10").formulas = [["=SUM(K4:K9)"]];

sheet.getRange("A13").values = [
  [
    "自我月度总结：5月主要围绕中东语聊房互动增长和平台风控两条线推进。增长侧完成三方休闲游戏接入方案从v1.0到v1.5的评审补齐，输出游戏房客户端原型拆解、后台配置、埋点验收、资产结算与异常边界规则；商业化侧完成幸运礼物玩法方案、红包玩法风控梳理；风控/财务侧补齐主播小号防控、设备/IP/公会处罚、预支/借支官方扣除等PRD。整体能主动承接复杂需求，将模糊问题拆成可评审、可开发、可测试的规则，后续需要继续加强上线后数据复盘和效果验证。",
  ],
];
sheet.getRange("A15").values = [
  [
    "下月重点工作计划：1. 推动三方休闲游戏进入开发/联调/灰度，重点跟进H5加载、扣费结算、退款补偿、最小化恢复和埋点看板；2. 跟进幸运礼物/红包玩法的风控阈值确认、后台配置与成本模型，确保合规和平台成本可控；3. 配合研发、测试、运营完成风控与结算类需求评审、用例验收和上线复盘；4. 灰度后输出数据分析和下一轮优化建议。",
  ],
];

sheet.getRange("G4:G9").format.wrapText = true;
sheet.getRange("A13:K15").format.wrapText = true;
sheet.getRange("G1:G18").format.columnWidthPx = 330;
sheet.getRange("H4:H10").setNumberFormat("0%");
sheet.getRange("I4:K10").setNumberFormat("0.0");
sheet.getRange("C10").setNumberFormat("0%");

const rowHeights = new Map([
  [4, 135],
  [5, 95],
  [6, 145],
  [7, 130],
  [8, 130],
  [9, 120],
  [13, 110],
  [15, 95],
]);
for (const [row, height] of rowHeights) {
  sheet.getRange(`A${row}:K${row}`).format.rowHeightPx = height;
}

const tableView = await workbook.inspect({
  kind: "table",
  range: "绩效考核表!A1:K18",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 12,
  summary: "performance form used range",
});
console.log(tableView.ndjson);

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(formulaErrors.ndjson);

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({
  sheetName: "绩效考核表",
  range: "A1:K18",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath }));
