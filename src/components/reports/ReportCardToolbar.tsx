import { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Button from "../ui/Button";

async function exportElementAsPdf(element: HTMLElement, fileName: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: Math.max(element.scrollWidth, element.clientWidth),
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageCanvasHeight = Math.floor(canvas.width * pageHeight / pageWidth);
  const pageCount = Math.max(1, Math.ceil(canvas.height / pageCanvasHeight));

  for (let page = 0; page < pageCount; page += 1) {
    const sourceY = page * pageCanvasHeight;
    const sliceHeight = Math.min(pageCanvasHeight, canvas.height - sourceY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const context = pageCanvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare the PDF page.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    if (page > 0) pdf.addPage();
    const imageHeight = sliceHeight * pageWidth / canvas.width;
    pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 0, 0, pageWidth, imageHeight);
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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  async function handleExportPdf(): Promise<void> {
    const element = document.getElementById(previewId);
    if (!element) {
      setExportError("The report is not ready to download. Refresh it and try again.");
      return;
    }

    setExporting(true);
    setExportError("");
    try {
      await exportElementAsPdf(element, fileName);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Unable to create the PDF. Please use Print instead.");
    } finally {
      setExporting(false);
    }
  }

  function handlePrint(): void {
    setExportError("");
    window.print();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Button type="button" variant="secondary" onClick={handlePrint}>
          Print report
        </Button>
        <Button type="button" onClick={() => void handleExportPdf()} disabled={exporting}>
          {exporting ? "Preparing PDF..." : "Download full PDF"}
        </Button>
      </div>
      {exportError ? <p role="alert" style={{ color: "#b91c1c", margin: "8px 0 0" }}>{exportError}</p> : null}
    </div>
  );
}
