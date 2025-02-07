import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import FileUploadArea from "./FileUploadArea";
import TranscriptionArea from "./TranscriptionArea";

const geminiModels = [
  {
    value: "gemini-2.0-flash-thinking-exp-01-21",
    label: "Gemini 2.0 Flash Thinking (Long Audio, Slower)",
    description: "Slow but handles long audio",
  },
  {
    value: "gemini-2.0-flash-exp",
    label: "Gemini 2.0 Flash (Faster, Shorter Audio)",
    description: "Faster, suitable for shorter audio clips",
  },
  {
    value: "gemini-2.0-flash-lite-preview-02-05",
    label: "Gemini 2.0 Flash Lite (Very Fast, Lower Quality)",
    description: "Very fast but with reduced quality, use for short clips",
  },
];

export default function TranscriptionApp() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("geminiApiKey") || "";
    }
    return "";
  });
  const [tempApiKey, setTempApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const ffmpegRef = useRef(new FFmpeg());
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(geminiModels[0].value);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamRef = useRef<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Abort Controller
  const abortControllerRef = useRef<AbortController | null>(null);

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
            "text/javascript",
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm",
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

  const compressFile = useCallback(
    async (
      file: File,
      onCompressionFinished: (compressedFile: File) => void,
    ) => {
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
          },
        );

        // Call the callback with the compressed file
        onCompressionFinished(compressedFile);

        toast.success("File compressed successfully");
      } catch (error) {
        console.error("Compression error:", error);
        toast.error("Failed to compress file");
      } finally {
        setIsLoading(false);
        setCompressionProgress(0);
      }
    },
    [],
  );

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
    [getAudioDuration],
  );

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setTranscriptionText("");
    setIsTranscribing(false);
    setCompressionProgress(0);
    setFileDuration(null);
    setCustomInstructions("");
    setIsCancelling(false);
    if (streamRef.current) {
      streamRef.current.return();
      streamRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const handleApiKeyChange = (newKey: string) => {
    setTempApiKey(newKey);
  };

  const handleSaveApiKey = () => {
    setApiKey(tempApiKey);
    if (typeof window !== "undefined") {
      if (tempApiKey) {
        localStorage.setItem("geminiApiKey", tempApiKey);
      } else {
        localStorage.removeItem("geminiApiKey");
      }
    }
  };

  const handleResetApiKey = () => {
    setTempApiKey(apiKey);
    setApiKey("");
  };

  const toggleShowApiKey = () => {
    setShowApiKey(!showApiKey);
  };

  const handleCancelTranscription = useCallback(() => {
    setIsCancelling(true);
    if (streamRef.current) {
      streamRef.current.return();
      streamRef.current = null;
    }
    // Abort the fetch if it's in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTranscribing(false);
    toast.info("Transcription cancelled.");
  }, []);

  const transcribeAudio = useCallback(async () => {
    if (!selectedFile) return;
    if (!apiKey) {
      toast.error("Please enter your Gemini API key first");
      return;
    }

    setIsTranscribing(true);
    setTranscriptionText("");
    setIsCancelling(false);

    // Create a new AbortController instance
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Initialize Gemini AI with the current API key
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: selectedModel,
      });

      // Convert audio to base64
      const buffer = await selectedFile.arrayBuffer();
      const audioData = Buffer.from(buffer).toString("base64");

      // Check file size again before transcription
      if (selectedFile.size > 25 * 1024 * 1024) {
        toast.error(
          "File is too large. Please try compressing it again or choose a different file.",
        );
        return;
      }

      // Start the streaming transcription
      try {
        const result = await model.generateContentStream(
          {
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
                    inlineData: {
                      mimeType: selectedFile.type,
                      data: audioData,
                    },
                  },
                ],
              },
            ],
          },
          { signal: signal },
        ); // Pass the AbortSignal

        streamRef.current = result.stream;
        // Handle the streaming response
        for await (const chunk of streamRef.current) {
          if (isCancelling) {
            break; // Stop processing if cancellation is requested
          }
          const chunkText = chunk.text();
          setTranscriptionText((prev) => prev + chunkText);
        }
      } catch (error: unknown) {
        if (signal.aborted) {
          // Check if the AbortSignal was the reason
          console.log("Transcription aborted by user.");
          toast.info("Transcription aborted.");
        } else {
          // Re-throw the error if it wasn't an abort error
          throw error;
        }
      }

      if (!isCancelling) {
        toast.success("Transcription complete");
      }
    } catch (error: unknown) {
      console.error("Transcription error:", error);
      if (error instanceof Error && error.message?.includes("API key")) {
        toast.error(
          "Invalid API key. Please check your API key and try again.",
        );
      } else {
        toast.error("Failed to transcribe audio");
      }
    } finally {
      setIsTranscribing(false);
      setIsCancelling(false);
      streamRef.current = null;
      abortControllerRef.current = null; // Clear the AbortController
    }
  }, [selectedFile, customInstructions, apiKey, selectedModel, isCancelling]);

  const handleCompressedFile = useCallback((compressedFile: File) => {
    setSelectedFile(compressedFile);
  }, []);

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>AI Audio Transcriber</CardTitle>
          {apiKey && (
            <Button variant="secondary" size="sm" onClick={handleResetApiKey}>
              Reset API Key
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Show API Key Input or Main Content */}
          {!apiKey ? (
            <div className="space-y-4 p-6 flex flex-col items-center justify-center border-2 border-dashed rounded-lg">
              <h2 className="text-lg font-semibold">
                Enter Your Gemini API Key
              </h2>
              <p className="text-sm text-center text-muted-foreground max-w-md">
                To use the audio transcription service, please enter your Gemini
                API key. Your key is stored locally and never sent to our
                servers.
              </p>
              <div className="w-full max-w-md relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter your Gemini API key"
                  value={tempApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleShowApiKey}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6"
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">Show/Hide API Key</span>
                </Button>
              </div>
              <div className="flex flex-row gap-2">
                <Link
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                >
                  <Button variant="secondary">Get API Key</Button>
                </Link>
                <Button onClick={handleSaveApiKey}>Save API Key</Button>
              </div>
            </div>
          ) : (
            <>
              {/* File Upload Section */}
              {!selectedFile && (
                <FileUploadArea
                  onFileSelected={handleFileSelected}
                  onCompressFile={(file) =>
                    compressFile(file, handleCompressedFile)
                  }
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
                          {fileDuration
                            ? formatDuration(fileDuration)
                            : "Unknown"}
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
                      <p className="text-sm font-medium mb-1">
                        Custom Instructions (optional)
                      </p>
                      <Textarea
                        placeholder="Example: 'Transcribe professionally with no duplicate words or stumbling phrases like um or uh'"
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>

                    <div className="flex flex-col">
                      <p className="text-sm font-medium mb-1">Select Model</p>
                      <Select
                        value={selectedModel}
                        onValueChange={setSelectedModel}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {geminiModels.map((model) => (
                            <SelectItem key={model.value} value={model.value}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                <TranscriptionArea
                  text={transcriptionText}
                  isTranscribing={isTranscribing}
                  onCancel={
                    isTranscribing && !isCancelling
                      ? handleCancelTranscription
                      : undefined
                  }
                />
              )}
              {(isTranscribing || transcriptionText) &&
                !isTranscribing &&
                transcriptionText && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleReset}
                  >
                    Transcribe Another File
                  </Button>
                )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
