"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { Download, File, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const AudioCompressor = () => {
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const ffmpegRef = useRef(new FFmpeg());
  const [originalAudioURL, setOriginalAudioURL] = useState<string | null>(null);
  const [compressedAudioURL, setCompressedAudioURL] = useState<string | null>(
    null,
  );
  const [inputFileName, setInputFileName] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [ffmpegLoadProgress, setFfmpegLoadProgress] = useState<number>(0);

  // Initialize FFmpeg (only once)
  useEffect(() => {
    const loadFFmpeg = async () => {
      setIsLoading(true);
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      const ffmpeg = ffmpegRef.current;

      const startTime = performance.now();

      ffmpeg.on("log", ({ message }) => {
        console.log(message);
      });

      ffmpeg.on("progress", (p) => {
        setCompressionProgress(p.progress);
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
        toast.success("FFmpeg Loaded", {
          description: `FFmpeg core is ready to compress audio. Loaded in ${((performance.now() - startTime) / 1000).toFixed(2)}s`,
        });
      } catch (error) {
        console.error("FFmpeg loading error:", error);
        toast.error("Error Loading FFmpeg", {
          description: "Failed to load FFmpeg core.",
        });
      } finally {
        setIsLoading(false);
        setFfmpegLoadProgress(0);
      }
    };

    loadFFmpeg();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        toast.error("No File Selected", {
          description: "Please select an audio file.",
        });
        return;
      }

      if (file.type !== "audio/mpeg" && file.type !== "audio/mp3") {
        toast.error("Invalid File Type", {
          description: "Please select a valid MP3 audio file.",
        });
        return;
      }

      setInputFileName(file.name);
      setOriginalAudioURL(URL.createObjectURL(file));
      setCompressedAudioURL(null);
    },
    [],
  );

  const compressAudio = useCallback(async () => {
    if (!originalAudioURL || !inputFileName) {
      toast.error("No Audio File", {
        description: "Please select an audio file first.",
      });
      return;
    }

    setIsLoading(true);
    setCompressionProgress(0);

    try {
      const ffmpeg = ffmpegRef.current;
      const inputFileBaseName = "input.mp3";

      const response = await fetch(originalAudioURL);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await ffmpeg.writeFile(inputFileBaseName, uint8Array);

      const outputFileName = "output.mp3";
      await ffmpeg.exec([
        "-i",
        inputFileBaseName,
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
      const blob = new Blob([data], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      setCompressedAudioURL(url);

      toast.success("Compression Complete", {
        description: "Audio compression finished successfully.",
      });
    } catch (error) {
      console.error("FFmpeg compression error:", error);
      toast.error("Compression Error", {
        description: "Failed to compress the audio.",
      });
    } finally {
      setIsLoading(false);
      setCompressionProgress(0);
    }
  }, [originalAudioURL, inputFileName]);

  const downloadCompressedAudio = useCallback(() => {
    if (!compressedAudioURL) {
      toast.error("No Compressed Audio", {
        description: "Please compress the audio first.",
      });
      return;
    }

    const link = document.createElement("a");
    link.href = compressedAudioURL;
    link.download = "compressed_audio.mp3";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [compressedAudioURL]);

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Audio Compressor</CardTitle>
          <CardDescription>
            Compress your audio files using FFmpeg.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {/* FFmpeg Loading State */}
          {isLoading && !ffmpegLoaded && (
            <div className="flex items-center space-x-2">
              <Loader2 className="animate-spin" size={20} />
              <p className="text-sm font-medium leading-none">
                Loading FFmpeg...
              </p>
            </div>
          )}

          {/* Audio Upload Section */}
          <div className="flex flex-col space-y-2">
            <label
              htmlFor="audio-upload"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed"
            >
              <File className="inline-block mr-1" size={16} />
              Upload Audio File (MP3)
            </label>
            <Input
              type="file"
              id="audio-upload"
              accept="audio/mp3, audio/mpeg"
              onChange={handleFileChange}
              disabled={isLoading}
              ref={audioInputRef}
            />
            {originalAudioURL && (
              <>
                <p className="text-sm font-medium leading-none">
                  Original Audio:
                </p>
                <audio controls src={originalAudioURL} className="w-full" />
              </>
            )}
          </div>

          {/* Compression Progress Section */}
          {compressionProgress > 0 && (
            <div>
              <p className="text-sm font-medium leading-none">
                Compression Progress:
              </p>
              <Progress value={compressionProgress * 100} />
            </div>
          )}

          {/* Compressed Audio Preview */}
          {compressedAudioURL && (
            <div className="mt-4">
              <p className="text-sm font-medium leading-none">
                Compressed Audio:
              </p>
              <audio controls src={compressedAudioURL} className="w-full" />
            </div>
          )}
        </CardContent>

        {/* Action Buttons */}
        <CardFooter className="flex justify-between">
          <Button
            onClick={compressAudio}
            disabled={isLoading || !originalAudioURL || !ffmpegLoaded}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={16} />
                Compressing...
              </>
            ) : (
              "Compress Audio"
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={downloadCompressedAudio}
            disabled={isLoading || !compressedAudioURL}
          >
            <Download className="inline-block mr-1" size={16} />
            Download Compressed Audio
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AudioCompressor;
