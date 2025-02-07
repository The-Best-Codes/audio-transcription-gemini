import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Download, Loader2 } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

interface TranscriptionAreaProps {
  text: string;
  isTranscribing: boolean;
}

export default function TranscriptionArea({
  text,
  isTranscribing,
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

  return (
    <Card className="p-4">
      <ScrollArea className="h-[400px] w-full rounded-md border p-4">
        <div className="max-w-[600px] mx-auto">
          {isTranscribing && !text && (
            <div className="flex items-center justify-center h-full gap-2">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-muted-foreground">Transcribing audio...</p>
            </div>
          )}

          <p className="text-lg leading-relaxed whitespace-pre-wrap">{text}</p>

          {!isTranscribing && text && (
            <div className="flex justify-end gap-2 mt-4 sticky bottom-0 bg-background p-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
