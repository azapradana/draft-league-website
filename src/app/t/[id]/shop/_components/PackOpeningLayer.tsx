"use client";

import { AnimatePresence } from "framer-motion";
import PackOpeningModal, { type PackPull } from "./PackOpeningModal";

export default function PackOpeningLayer({
  sequenceKey,
  pulls,
  packImage,
  packPrice,
  practiceMode,
  onRepeat,
  onClose,
}: {
  sequenceKey: string;
  pulls: PackPull[] | null;
  packImage: string | null;
  packPrice: number;
  practiceMode?: boolean;
  onRepeat?: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {pulls && (
        <PackOpeningModal
          key={sequenceKey}
          pulls={pulls}
          packImage={packImage}
          packPrice={packPrice}
          practiceMode={practiceMode}
          onRepeat={onRepeat}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}
