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
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const AudioCompressor = () => {
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // For file upload progress
  const [compressionProgress, setCompressionProgress] = useState(0); // For FFmpeg progress
  const ffmpegRef = useRef(new FFmpeg());
  const [originalAudioURL, setOriginalAudioURL] = useState<string | null>(null);
  const [compressedAudioURL, setCompressedAudioURL] = useState<string | null>(
    null,
  );
  const [inputFileName, setInputFileName] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null); // Ref for the input element

  // Initialize FFmpeg (only once)
  useEffect(() => {
    const loadFFmpeg = async () => {
      setIsLoading(true);
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on("log", ({ message }) => {
        console.log(message); // Consider better logging in production
      });

      ffmpeg.on("progress", (p) => {
        setCompressionProgress(p.progress); // Update compression progress
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
        setLoaded(true);
        toast("FFmpeg Loaded", {
          description: "FFmpeg core is ready to compress audio.",
        });
      } catch (error) {
        console.error("FFmpeg loading error:", error);
        toast("Error Loading FFmpeg", {
          description: "Failed to load FFmpeg core.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadFFmpeg();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        toast("No File Selected", {
          description: "Please select an audio file.",
        });
        return;
      }

      if (file.type !== "audio/mpeg" && file.type !== "audio/mp3") {
        toast("Invalid File Type", {
          description: "Please select a valid MP3 audio file.",
        });
        return;
      }

      setInputFileName(file.name);
      setOriginalAudioURL(URL.createObjectURL(file));
    },
    [],
  );

  const compressAudio = useCallback(async () => {
    if (!originalAudioURL || !inputFileName) {
      toast("No Audio File", {
        description: "Please select an audio file first.",
      });
      return;
    }

    setIsLoading(true);
    setCompressionProgress(0); // Reset progress

    try {
      const ffmpeg = ffmpegRef.current;
      const inputFileBaseName = "input.mp3"; // Consistent input name

      // Fetch the audio data and write it to FFmpeg's virtual file system
      const response = await fetch(originalAudioURL);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await ffmpeg.writeFile(inputFileBaseName, uint8Array);

      // Execute the FFmpeg command
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

      // Read the compressed audio data
      const data = await ffmpeg.readFile(outputFileName);
      const blob = new Blob([data], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      setCompressedAudioURL(url);

      toast("Compression Complete", {
        description: "Audio compression finished successfully.",
      });
    } catch (error) {
      console.error("FFmpeg compression error:", error);
      toast("Compression Error", {
        description: "Failed to compress the audio.",
      });
    } finally {
      setIsLoading(false);
      setCompressionProgress(0);
    }
  }, [originalAudioURL, inputFileName]);

  const downloadCompressedAudio = useCallback(() => {
    if (!compressedAudioURL) {
      toast("No Compressed Audio", {
        description: "Please compress the audio first.",
      });
      return;
    }

    const link = document.createElement("a");
    link.href = compressedAudioURL;
    link.download = "compressed_audio.mp3"; // Customize the download name
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
          <div className="flex flex-col space-y-2">
            <label
              htmlFor="audio-upload"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed"
            >
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
              <audio controls src={originalAudioURL} className="w-full"></audio>
            )}
          </div>

          {compressionProgress > 0 && (
            <div>
              <p className="text-sm font-medium leading-none">
                Compression Progress:
              </p>
              <Progress value={compressionProgress * 100} />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            onClick={compressAudio}
            disabled={isLoading || !originalAudioURL}
          >
            {isLoading ? "Compressing..." : "Compress Audio"}
          </Button>
          <Button
            variant="secondary"
            onClick={downloadCompressedAudio}
            disabled={isLoading || !compressedAudioURL}
          >
            Download Compressed Audio
          </Button>
        </CardFooter>
      </Card>

      {compressedAudioURL && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Compressed Audio</CardTitle>
            <CardDescription>Listen to the compressed audio.</CardDescription>
          </CardHeader>
          <CardContent>
            <audio controls src={compressedAudioURL} className="w-full"></audio>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AudioCompressor;
