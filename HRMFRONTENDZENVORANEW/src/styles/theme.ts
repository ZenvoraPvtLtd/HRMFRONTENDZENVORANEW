export interface AppTheme {
  page: string;
  blur1: string;
  blur2: string;
  card: string;
  logo: string;
  tagline: string;
  toggleBtn: string;
  heading: string;
  subtext: string;
  label: string;
  input: string;
  inputIcon: string;
  eyeBtn: string;
  dividerLine: string;
  dividerText: string;
  checkLabel: string;
  forgotLink: string;
  badge: string;
  footerText: string;
  signupLink: string;
  featureCard: string;
  featureTitle: string;
  featureDesc: string;
  bottomBar: string;
  select: string;
  selectOption: string;
  strengthBg: string;
  termsText: string;
  link: string;
}

export const darkTheme: AppTheme = {
  page: "bg-black",
  blur1: "bg-white/5",
  blur2: "bg-white/5",
  card: "bg-[#111111] border-white/10",
  logo: "text-white",
  tagline: "text-gray-400",
  toggleBtn: "bg-white/5 border-white/10 text-white hover:text-white",
  heading: "text-white",
  subtext: "text-gray-400",
  label: "text-white",
  input:
    "bg-[#1a1a1a] border-white/10 text-white placeholder:text-gray-500 focus:border-white/40 text-base",
  inputIcon: "text-gray-400",
  eyeBtn: "text-gray-400 hover:text-white",
  dividerLine: "bg-white/10",
  dividerText: "text-gray-400",
  checkLabel: "text-gray-300",
  forgotLink: "text-gray-300 hover:text-white",
  badge: "text-gray-400",
  footerText: "text-gray-400",
  signupLink: "text-white hover:text-gray-300",
  featureCard: "bg-white/5 border-white/10 backdrop-blur-lg",
  featureTitle: "text-white",
  featureDesc: "text-gray-400",
  bottomBar: "text-gray-500",
  select: "bg-[#1a1a1a] border-white/10 text-white focus:border-white/40 text-base",
  selectOption: "bg-[#111111]",
  strengthBg: "bg-white/10",
  termsText: "text-gray-300",
  link: "text-white hover:text-gray-300",
};

export const lightTheme: AppTheme = {
  page: "bg-[#f5f5f5]",
  blur1: "bg-black/5",
  blur2: "bg-black/5",
  card: "bg-white border-black/10 shadow-xl",
  logo: "text-black",
  tagline: "text-gray-500",
  toggleBtn: "bg-gray-100 border-gray-300 text-black hover:text-black",
  heading: "text-black",
  subtext: "text-gray-500",
  label: "text-gray-900",
  input:
    "bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-gray-500 text-base shadow-sm",
  inputIcon: "text-gray-400",
  eyeBtn: "text-gray-400 hover:text-black",
  dividerLine: "bg-gray-200",
  dividerText: "text-gray-400",
  checkLabel: "text-gray-600",
  forgotLink: "text-gray-700 hover:text-black",
  badge: "text-gray-500",
  footerText: "text-gray-500",
  signupLink: "text-black hover:text-gray-700",
  featureCard: "bg-white border-gray-200 shadow-sm",
  featureTitle: "text-gray-800",
  featureDesc: "text-gray-500",
  bottomBar: "text-gray-400",
  select: "bg-white border-gray-300 text-black focus:border-gray-500 text-base shadow-sm",
  selectOption: "bg-white",
  strengthBg: "bg-gray-200",
  termsText: "text-gray-600",
  link: "text-black hover:text-gray-700",
};
