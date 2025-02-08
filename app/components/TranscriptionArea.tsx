import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Download, Loader2, X } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

interface TranscriptionAreaProps {
  text: string;
  isTranscribing: boolean;
  isUploading: boolean;
  onCancel?: () => void; // Add the onCancel prop
}

export default function TranscriptionArea({
  text,
  isTranscribing,
  isUploading,
  onCancel, // Destructure the onCancel prop
}: TranscriptionAreaProps) {
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Text copied to clipboard");
    } catch (err) {
      console.error("Failed to copy text:", err);
      toast.error("Failed to copy text");
    }
  }, [text]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transcription.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Transcription downloaded");
  }, [text]);

  let statusMessage = "";
  if (isUploading) {
    statusMessage = "Uploading, this may take several minutes...";
  } else if (isTranscribing) {
    statusMessage = "Transcribing audio...";
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        {(isTranscribing || isUploading) && (
          <div className="flex items-center h-full gap-2">
            <Loader2 className="animate-spin text-foreground" />
            <p className="text-foreground">{statusMessage}</p>
          </div>
        )}
        {(isTranscribing || isUploading) && onCancel && (
          <Button variant="destructive" onClick={onCancel}>
            <X className="w-4 h-4" />
            Cancel
          </Button>
        )}
      </div>
      <ScrollArea className="h-96 w-full rounded-md border p-4 mt-2">
        <div className="w-full">
          <p className="text-lg leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>
      </ScrollArea>
      {!isTranscribing && !isUploading && text && (
        <div className="flex justify-end gap-2 mt-4 sticky bottom-0 bg-background p-2">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="w-4 h-4" />
            Copy
          </Button>
          <Button onClick={handleDownload}>
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      )}
    </Card>
  );
}
