/**
 * 렌더링된 포트폴리오 DOM 노드를 A4 PDF로 내보냅니다.
 *
 * html2canvas로 노드 전체(스크롤 밖 영역 포함)를 캔버스 한 장으로 찍은 뒤,
 * 그 캔버스를 A4 페이지 높이만큼씩 잘라 jsPDF 페이지에 이어 붙입니다 —
 * 포트폴리오는 길이가 프로젝트 개수에 따라 달라지므로 페이지 수를 미리
 * 정할 수 없고, 이 방식이 내용이 페이지 경계에서 이미지처럼 깔끔하게
 * 잘리는 대신 구현이 단순해서 첫 버전으로 택했습니다(텍스트가 페이지
 * 중간에서 줄 단위로 잘리는 것까지는 막지 못합니다 — 다음 단계 개선 여지).
 */
export async function exportNodeToPdf(node: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: null,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight,
  });

  const pdf = new jsPDF({ unit: "px", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/png");

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
