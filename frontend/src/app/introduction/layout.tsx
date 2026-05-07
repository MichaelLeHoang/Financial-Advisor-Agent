export default function CoverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {children}
    </div>
  );
}
