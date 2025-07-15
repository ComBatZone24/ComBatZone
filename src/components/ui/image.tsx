
"use client"

import NextImage, { type ImageProps as NextImageProps } from "next/image";
import { cn } from "@/lib/utils";

interface ImageProps extends NextImageProps {
  // You can add any custom props here if needed
}

const Image: React.FC<ImageProps> = ({ className, alt, ...props }) => {
  return (
    <NextImage
      className={cn(className)}
      alt={alt}
      {...props}
    />
  );
};

export default Image;
