import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface FileUploadAreaProps {
  onFileSelected: (file: File) => void;
  onCompressFile: (file: File) => void;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

export default function FileUploadArea({
  onFileSelected,
  onCompressFile,
}: FileUploadAreaProps) {
  const [dragActive, setDragActive] = useState(false);
  const [oversizedFile, setOversizedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  }, []);

  const handleFileSelection = useCallback(
    (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        setOversizedFile(file);
      } else {
        onFileSelected(file);
      }
    },
    [onFileSelected],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelection(file);
      }
    },
    [handleFileSelection],
  );

  const handleCompressFile = useCallback(() => {
    if (oversizedFile) {
      onCompressFile(oversizedFile);
      setOversizedFile(null);
    }
  }, [oversizedFile, onCompressFile]);

  const handleTryAnotherFile = useCallback(() => {
    setOversizedFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  if (oversizedFile) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Large File Detected</AlertTitle>
        <AlertDescription>
          <p className="mb-4">
            The selected file is larger than 25MB. Would you like to compress it
            or try another file?
          </p>
          <div className="flex gap-4">
            <Button onClick={handleCompressFile}>Compress File</Button>
            <Button variant="outline" onClick={handleTryAnotherFile}>
              Try Another File
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card
      className={`relative p-8 border-2 border-dashed rounded-lg text-center ${
        dragActive
          ? "border-primary bg-primary/10"
          : "border-muted-foreground/25"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleFileDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-4">
        <Upload className="w-12 h-12 text-muted-foreground" />
        <div>
          <p className="text-lg font-medium">
            Drag and drop your audio file here
          </p>
          <p className="text-sm text-muted-foreground">or</p>
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() => inputRef.current?.click()}
          >
            Choose File
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Supported formats: MP3, WAV, M4A, etc.
        </p>
      </div>
    </Card>
  );
}
