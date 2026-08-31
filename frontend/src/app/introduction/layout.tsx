export default function CoverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh min-w-0">
      {children}
    </div>
  );
}
