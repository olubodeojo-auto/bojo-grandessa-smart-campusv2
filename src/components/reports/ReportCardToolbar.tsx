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

  const imageWidth = pageWidth;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;

  if (imageHeight <= pageHeight) {
    pdf.addImage(imgData, "PNG", 0, 0, imageWidth, imageHeight);
  } else {
    let heightLeft = imageHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imageWidth, imageHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imageWidth, imageHeight);
      heightLeft -= pageHeight;
    }
  }

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
        Export PDF
      </Button>
    </div>
  );
}
