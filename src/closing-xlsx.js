import { strToU8, zipSync } from "fflate";

const xml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const col = (index) => {
  let value = index + 1;
  let output = "";
  while (value) { value -= 1; output = String.fromCharCode(65 + value % 26) + output; value = Math.floor(value / 26); }
  return output;
};
const cell = (value, row, column) => Number.isFinite(value)
  ? `<c r="${col(column)}${row}"><v>${value}</v></c>`
  : `<c r="${col(column)}${row}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const sheet = (rows) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((values, index) => `<row r="${index + 1}">${values.map((value, column) => cell(value, index + 1, column)).join("")}</row>`).join("")}</sheetData></worksheet>`;

export function closingWorkbookRows(closure, orders) {
  const labels = { completed: "완료", done: "완료", cancelled: "취소", refunded: "환불" };
  return [
    [["항목", "값"], ["전체 주문금액", Number(closure.total_order_amount || 0)], ["취소 금액", Number(closure.cancelled_amount || 0)], ["환불 금액", Number(closure.refunded_amount || 0)], ["순매출", Number(closure.net_revenue || 0)], ["전체 주문 수", Number(closure.total_order_count || 0)], ["완료 주문 수", Number(closure.completed_order_count || 0)], ["취소·환불 주문 수", Number(closure.cancelled_order_count || 0)], ["마감 시각", closure.closed_at || ""]],
    [["주문번호", "상태", "금액", "결제수단", "주문시각", "완료시각", "환불시각"], ...orders.map((order) => [order.number ?? "", labels[order.status] || order.status, Number(order.total || 0), order.payment_method || "", order.created_at || "", order.completed_at || "", order.refunded_at || ""])],
    [["구분", "주문 수", "금액"], ...["완료", "취소", "환불"].map((label) => { const selected = orders.filter((order) => labels[order.status] === label); return [label, selected.length, selected.reduce((sum, order) => sum + Number(order.total || 0), 0)]; })],
  ];
}

export function createClosingXlsx(closure, orders) {
  const names = ["일일 요약", "주문 목록", "완료·취소·환불 구분"];
  const rows = closingWorkbookRows(closure, orders);
  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`),
  };
  rows.forEach((values, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheet(values)); });
  return zipSync(files, { level: 6 });
}

export function closingFilename(storeName, businessDate) {
  const safe = String(storeName || "매장").normalize("NFKC").replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 50) || "매장";
  return `GENO_${safe}_${businessDate}_영업마감.xlsx`;
}
