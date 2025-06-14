import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, Clock, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface FileUploadAreaProps {
  onFileSelected: (file: File) => void;
  onCompressFile: (file: File) => void;
  isCompressing?: boolean;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes
const MAX_DURATION = 8 * 60 * 60; // 8 hours in seconds

export default function FileUploadArea({
  onFileSelected,
  onCompressFile,
  isCompressing = false,
}: FileUploadAreaProps) {
  const [oversizedFile, setOversizedFile] = useState<File | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);

  const checkAudioDuration = useCallback(
    async (file: File): Promise<number> => {
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
    },
    [],
  );

  const handleFileSelection = useCallback(
    async (file: File) => {
      setDurationError(null);

      try {
        const duration = await checkAudioDuration(file);
        if (duration > MAX_DURATION) {
          setDurationError(
            "Audio file is longer than 8 hours. Please choose a shorter file.",
          );
          return;
        }

        if (file.size > MAX_FILE_SIZE) {
          setOversizedFile(file);
        } else {
          onFileSelected(file);
        }
      } catch (error) {
        console.error("Error checking audio duration:", error);
        setDurationError(
          "Failed to check audio duration. Please try another file.",
        );
      }
    },
    [onFileSelected, checkAudioDuration],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback(
      async (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
          await handleFileSelection(acceptedFiles[0]);
        }
      },
      [handleFileSelection],
    ),
    accept: {
      "audio/*": [],
    },
    disabled: isCompressing,
    multiple: false,
  });

  const handleCompressFile = useCallback(() => {
    if (oversizedFile) {
      onCompressFile(oversizedFile);
    }
  }, [oversizedFile, onCompressFile]);

  const handleTryAnotherFile = useCallback(() => {
    setOversizedFile(null);
    setDurationError(null);
  }, []);

  if (durationError) {
    return (
      <Alert variant="destructive" className="mb-4 rounded-md shadow-xs">
        <Clock className="h-5 w-5" />
        <AlertTitle className="text-lg font-semibold">
          Duration Limit Exceeded
        </AlertTitle>
        <AlertDescription className="text-sm">
          <p className="mb-4">{durationError}</p>
          <Button variant="destructive" onClick={handleTryAnotherFile}>
            Try Another File
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (oversizedFile) {
    return (
      <Alert
        variant="destructive"
        className="mb-4 rounded-md shadow-xs dark:bg-red-900/50 dark:border-red-700 dark:text-white"
      >
        <AlertCircle className="h-5 w-5 dark:text-white" />
        <AlertTitle className="text-lg font-semibold">
          Large File Detected
        </AlertTitle>
        <AlertDescription className="text-sm">
          <p className="mb-4">
            The selected file is larger than 25MB. Would you like to compress it
            or try another file?
          </p>
          <div className="flex gap-4">
            <Button onClick={handleCompressFile} disabled={isCompressing}>
              {isCompressing ? "Compressing..." : "Compress File"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleTryAnotherFile}
              disabled={isCompressing}
            >
              Try Another File
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card
      {...getRootProps()}
      className={`relative p-8 border-2 border-dashed rounded-lg text-center ${
        isDragActive
          ? "border-primary bg-primary/10"
          : isCompressing
            ? "border-muted-foreground/25 opacity-50 cursor-not-allowed"
            : "border-muted-foreground/25 cursor-pointer"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <Upload className="w-12 h-12 text-muted-foreground" />
        <div>
          <p className="text-lg font-medium">
            {isCompressing
              ? "File compression in progress..."
              : "Drag and drop your audio file here"}
          </p>
          <p className="text-sm text-muted-foreground">
            {!isCompressing && "or"}
          </p>
          {!isCompressing && <Button className="mt-2">Choose File</Button>}
        </div>
        <p className="text-sm text-muted-foreground">
          Supported formats: MP3, WAV, M4A, etc.
          <br />
          Maximum duration: 8 hours
        </p>
      </div>
    </Card>
  );
}
