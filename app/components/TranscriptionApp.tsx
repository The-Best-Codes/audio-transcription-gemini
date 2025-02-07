import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import FileUploadArea from "./FileUploadArea";
import TranscriptionArea from "./TranscriptionArea";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-thinking-exp-01-21",
});

export default function TranscriptionApp() {
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const ffmpegRef = useRef(new FFmpeg());

  // Initialize FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on("log", ({ message }) => {
        console.log(message);
      });

      ffmpeg.on("progress", (p) => {
        setCompressionProgress(p.progress * 100);
      });

      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript"
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm"
          ),
        });
        setFfmpegLoaded(true);
      } catch (error) {
        console.error("FFmpeg loading error:", error);
        toast.error("Failed to load audio processing tools");
      }
    };

    loadFFmpeg();
  }, []);

  const compressFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setCompressionProgress(0);

    try {
      const ffmpeg = ffmpegRef.current;
      const inputFileName =
        "input" + file.name.substring(file.name.lastIndexOf("."));

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await ffmpeg.writeFile(inputFileName, uint8Array);

      const outputFileName =
        "compressed" + file.name.substring(file.name.lastIndexOf("."));
      await ffmpeg.exec([
        "-i",
        inputFileName,
        "-b:a",
        "16k",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-compression_level",
        "9",
        outputFileName,
      ]);

      const data = await ffmpeg.readFile(outputFileName);
      const compressedBlob = new Blob([data], { type: file.type });
      const compressedFile = new File(
        [compressedBlob],
        "compressed_" + file.name,
        {
          type: file.type,
        }
      );

      setSelectedFile(compressedFile);
      toast.success("File compressed successfully");
    } catch (error) {
      console.error("Compression error:", error);
      toast.error("Failed to compress file");
    } finally {
      setIsLoading(false);
      setCompressionProgress(0);
    }
  }, []);

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
    setTranscriptionText("");
  }, []);

  const transcribeAudio = useCallback(async () => {
    if (!selectedFile) return;

    setIsTranscribing(true);
    setTranscriptionText("");

    try {
      // Convert audio to base64
      const buffer = await selectedFile.arrayBuffer();
      const audioData = Buffer.from(buffer).toString("base64");

      // Start the streaming transcription
      try {
        const result = await model.generateContentStream({
          contents: [
            {
              role: "user",
              parts: [
                { text: "Please transcribe this audio file accurately:" },
                {
                  inlineData: { mimeType: selectedFile.type, data: audioData },
                },
              ],
            },
          ],
        });

        // Handle the streaming response
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          setTranscriptionText((prev) => prev + chunkText);
        }
      } catch (error) {
        console.error("Generation error:", error);
        toast.error("Failed to process audio");
        return;
      }

      toast.success("Transcription complete");
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Failed to transcribe audio");
    } finally {
      setIsTranscribing(false);
    }
  }, [selectedFile]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setTranscriptionText("");
    setIsTranscribing(false);
    setCompressionProgress(0);
  }, []);

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>AI Audio Transcriber</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload Section */}
          {!selectedFile && (
            <FileUploadArea
              onFileSelected={handleFileSelected}
              onCompressFile={compressFile}
            />
          )}

          {/* Compression Progress */}
          {isLoading && compressionProgress > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Compressing audio... {Math.round(compressionProgress)}%
              </p>
              <Progress value={compressionProgress} />
            </div>
          )}

          {/* Selected File Info & Actions */}
          {selectedFile && !isTranscribing && !transcriptionText && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Selected file: {selectedFile.name}
                </p>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Choose Another File
                </Button>
              </div>
              <Button
                className="w-full"
                onClick={transcribeAudio}
                disabled={isLoading}
              >
                Transcribe Audio
              </Button>
            </div>
          )}

          {/* Transcription Area */}
          {(isTranscribing || transcriptionText) && (
            <div className="space-y-4">
              <TranscriptionArea
                text={transcriptionText}
                isTranscribing={isTranscribing}
              />
              {!isTranscribing && transcriptionText && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleReset}
                >
                  Transcribe Another File
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
