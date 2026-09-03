/**
 * Centralized Developer Attribution Configuration
 * 
 * Update developer photo and social links in this single file.
 * If photoUrl is empty, a clean, professional placeholder avatar is displayed.
 */

export interface DeveloperProfileConfig {
  name: string;
  name_bn: string;
  role: string;
  role_bn: string;
  tagline: string;
  tagline_bn: string;
  photoUrl: string; // Real photo asset path (e.g. '/brand/developer.jpg'). Leave empty string if not yet provided.
  linkedin: string; // LinkedIn URL
  github: string;   // GitHub URL
  facebook: string; // Facebook URL
}

export const DEVELOPER_CONFIG: DeveloperProfileConfig = {
  name: "Alfi Shahrin Talukder",
  name_bn: "আলফি শাহরিন তালুকদার",
  role: "Developer / Creator",
  role_bn: "ডেভেলপার ও রূপকার",
  tagline: "Building technology for meaningful community impact.",
  tagline_bn: "জনকল্যাণমুখী প্রযুক্তি বিনির্মাণে নিবেদিত।",
  // [PHOTO PLACEHOLDER]: Place actual photo in public directory (e.g., public/brand/developer.jpg) and set '/brand/developer.jpg'
  photoUrl: "",
  linkedin: "https://www.linkedin.com/in/alfi-shahrin-talukder-a68450370/",
  github: "https://github.com/Alfi-svg",
  facebook: "https://www.facebook.com/alfi.shahrin.talukder",
};
