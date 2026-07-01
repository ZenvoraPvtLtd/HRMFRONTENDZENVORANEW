import EmployeeChatbot from './EmployeeChatbot';

export default function EmployeeChatbotPage() {
  return (
    <div className="animate-fade-in h-full w-full flex flex-col flex-1 bg-secondary m-0 p-0 border-0">
      <EmployeeChatbot isFullScreen={true} />
    </div>
  );
}
