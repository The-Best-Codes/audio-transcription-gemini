import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  model: "gemini-2.0-flash-thinking-exp-01-21", // or "gemini-2.0-flash-lite-preview-02-05"
});

export default function TranscriptionApp() {
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
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

  const formatFileSize = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getAudioDuration = useCallback(async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const reader = new FileReader();

      reader.onload = (e) => {
        audio.src = e.target?.result as string;
        audio.addEventListener("loadedmetadata", () => {
          resolve(audio.duration);
        });
        audio.addEventListener("error", () => {
          reject(new Error("Failed to load audio file"));
        });
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileSelected = useCallback(
    async (file: File) => {
      try {
        const duration = await getAudioDuration(file);
        setFileDuration(duration);
        setSelectedFile(file);
        setTranscriptionText("");
      } catch (error) {
        console.error("Error handling file selection:", error);
        toast.error("Failed to process the selected file");
      }
    },
    [getAudioDuration]
  );

  const transcribeAudio = useCallback(async () => {
    if (!selectedFile) return;

    setIsTranscribing(true);
    setTranscriptionText("");

    try {
      // Convert audio to base64
      const buffer = await selectedFile.arrayBuffer();
      const audioData = Buffer.from(buffer).toString("base64");

      // Check file size again before transcription
      if (selectedFile.size > 25 * 1024 * 1024) {
        toast.error(
          "File is too large. Please try compressing it again or choose a different file."
        );
        return;
      }

      // Start the streaming transcription
      try {
        const result = await model.generateContentStream({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "System instructions: You are an AI audio transcriber. Users will upload an audio file and you should transcribe it, responding only with the text content of the audio file and nothing else. Users may also provide custom instructions which you should take into account. If you hear no words, respond with 'No speech detected.'",
                },
              ],
            },
            {
              role: "model",
              parts: [
                {
                  text: "Understood.",
                },
              ],
            },
            {
              role: "user",
              parts: [
                {
                  text: customInstructions
                    ? `Please transcribe this audio file accurately. Custom instructions: ${customInstructions}.`
                    : "Please transcribe this audio file accurately:",
                },
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
  }, [selectedFile, customInstructions]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setTranscriptionText("");
    setIsTranscribing(false);
    setCompressionProgress(0);
    setFileDuration(null);
    setCustomInstructions("");
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
              isCompressing={isLoading}
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
                <Button onClick={handleReset}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Choose Another File
                </Button>
              </div>

              {/* File Metadata Card */}
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">File Name</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedFile.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Size</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Duration</p>
                    <p className="text-sm text-muted-foreground">
                      {fileDuration ? formatDuration(fileDuration) : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Type</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedFile.type || "audio/*"}
                    </p>
                  </div>
                </div>
              </Card>

              <div className="space-y-4">
                <div className="flex flex-col">
                  <p className="text-sm font-medium mb-1">Custom Instructions (optional)</p>
                  <Textarea
                    placeholder="Example: 'Transcribe professionally with no duplicate words or stumbling phrases like um or uh'"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={transcribeAudio}
                  disabled={isLoading}
                >
                  Transcribe Audio
                </Button>
              </div>
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
