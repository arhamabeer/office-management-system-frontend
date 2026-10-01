import Image from 'next/image';
import { BRAND } from '@ems/config';

export default function Logo({ height = 28 }: { height?: number }) {
  // Logo intrinsic ratio ~1024x252 ≈ 4.06:1
  const width = Math.round(height * 4.06);
  return (
    <Image
      src={BRAND.logo.horizontal}
      alt={`${BRAND.productName} logo`}
      width={width}
      height={height}
      priority
    />
  );
}
