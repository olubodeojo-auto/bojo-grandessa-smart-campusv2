import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Button from "../ui/Button";

async function exportElementAsPdf(element: HTMLElement, fileName: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageRatio = canvas.width / canvas.height;
  const pageRatio = pageWidth / pageHeight;
  const imageWidth = imageRatio > pageRatio ? pageWidth : pageHeight * imageRatio;
  const imageHeight = imageRatio > pageRatio ? pageWidth / imageRatio : pageHeight;
  const left = (pageWidth - imageWidth) / 2;
  const top = (pageHeight - imageHeight) / 2;

  pdf.addImage(imgData, "PNG", left, top, imageWidth, imageHeight);

  pdf.save(fileName);
}

export default function ReportCardToolbar({
  previewId,
  fileName,
}: {
  previewId: string;
  fileName: string;
}) {
  async function handleExportPdf(): Promise<void> {
    const element = document.getElementById(previewId);

    if (!element) {
      return;
    }

    await exportElementAsPdf(element, fileName);
  }

  function handlePrint(): void {
    window.print();
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Button type="button" variant="secondary" onClick={handlePrint}>
        Print
      </Button>
      <Button type="button" onClick={() => void handleExportPdf()}>
        Download PDF
      </Button>
    </div>
  );
}
