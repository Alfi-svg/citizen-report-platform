export type Language = "en" | "bn";

export const translations = {
  en: {
    // Navigation & Entry
    help_button: "I Need Help",
    safety_navigator: "Citizen Safety Navigator",
    emergency_call_999: "CALL 999",
    national_emergency_title: "National Emergency Service",
    national_emergency_desc: "24/7 Toll-Free National Hotline for Police, Fire, and Ambulance",
    
    // Actions & Buttons
    find_near_me: "Find Help Near Me",
    locating: "Locating nearest services...",
    choose_manually: "Choose Area Manually",
    call_now: "Call",
    get_directions: "Directions",
    change_location: "Change Location",
    refresh: "Refresh Location",
    
    // Headings & Categories
    nearest_police: "Nearest Police Station",
    nearest_police_box: "Nearby Police Box",
    other_emergency: "Fire & Other Emergency Services",
    all_nearby: "All Nearby Emergency Units",
    
    // Privacy & Disclaimers
    privacy_notice: "🔒 Your location is used only to find nearby emergency services. We never track, store, or share your live location.",
    permission_denied_title: "Location Permission Denied",
    permission_denied_desc: "Please enable location in your browser settings or select your area manually below.",
    error_unavailable: "Could not retrieve your GPS location. Please choose your area manually.",
    unverified_badge: "Pending Verification",
    verified_badge: "Official Verified",
    source_label: "Source",
    last_verified: "Verified",
    approx_distance: "Approx. distance",
    no_results: "No emergency units found in this radius. Try selecting an adjacent area.",
    
    // Manual Area Selection
    select_area_placeholder: "Select your area / landmark in Bangladesh...",
    quick_select_title: "Or Select a Common Metropolitan Area:",

    // Missing Person Alert Network
    missing_person_title: "Missing Person Alerts",
    missing_person_badge: "🚨 MISSING PERSON",
    last_seen_near: "Last seen near",
    last_seen_time: "Time last seen",
    identifying_details: "Identifying Features",
    clothing: "Clothing Worn",
    age: "Age",
    gender: "Gender",
    height: "Height",
    contact_authority: "Official Reporting Contact",
    i_saw_this_person: "I Saw This Person",
    submit_sighting: "Submit Sighting Information",
    community_sightings: "Moderated Community Sightings",
    no_sightings: "No verified sightings reported yet. If you have information, please click below.",
    sighting_disclaimer: "🔒 Your submission is reviewed by moderators before safe approximate updates are shared with officials.",
    approx_location_label: "Approximate Location Seen *",
    sighting_desc_label: "What did you see? Describe details *",
    sighting_time_label: "Time or Date Seen",
    status_active: "Active Search",
    status_found: "FOUND & SAFE",
    status_expired: "Search Expired",
    status_pending: "Under Verification",
  },
  bn: {
    // Navigation & Entry
    help_button: "আমার সাহায্য দরকার",
    safety_navigator: "সিটিজেন সেফটি নেভিগেটর",
    emergency_call_999: "৯৯৯ কল করুন",
    national_emergency_title: "জাতীয় জরুরি সেবা",
    national_emergency_desc: "পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্সের জন্য ২৪/৭ সার্বক্ষণিক ফ্রি জাতীয় হটলাইন",
    
    // Actions & Buttons
    find_near_me: "আমার নিকটস্থ সাহায্য খুঁজুন",
    locating: "নিকটস্থ সেবা খোঁজা হচ্ছে...",
    choose_manually: "নিজে এলাকা নির্বাচন করুন",
    call_now: "কল করুন",
    get_directions: "ম্যাপে দেখুন",
    change_location: "এলাকা পরিবর্তন করুন",
    refresh: "রিফ্রেশ করুন",
    
    // Headings & Categories
    nearest_police: "নিকটস্থ থানা",
    nearest_police_box: "কাছের পুলিশ বক্স",
    other_emergency: "ফায়ার ও অন্যান্য জরুরি সেবা",
    all_nearby: "নিকটস্থ সকল জরুরি সেবা কেন্দ্র",
    
    // Privacy & Disclaimers
    privacy_notice: "🔒 আপনার বর্তমান লোকেশন শুধুমাত্র নিকটস্থ জরুরি সেবাগুলো খুঁজে দিতে ব্যবহৃত হয়। আমরা কখনোই আপনার লোকেশন সংরক্ষণ বা ট্র্যাক করি না।",
    permission_denied_title: "লোকেশন পারমিশন দেওয়া হয়নি",
    permission_denied_desc: "ব্রাউজার সেটিংসে লোকেশন অন করুন অথবা নিচে থেকে আপনার এলাকাটি সরাসরি নির্বাচন করুন।",
    error_unavailable: "আপনার জিপিএস লোকেশন পাওয়া যায়নি। অনুগ্রহ করে তালিকা থেকে এলাকা নির্বাচন করুন।",
    unverified_badge: "যাচাই প্রক্রিয়াধীন",
    verified_badge: "সরকারি যাচাইকৃত",
    source_label: "উৎস",
    last_verified: "সর্বশেষ যাচাই",
    approx_distance: "আনুমানিক দূরত্ব",
    no_results: "এই এলাকার আশেপাশে কোনো নথিভুক্ত জরুরি সেবা পাওয়া যায়নি। পাশের এলাকা নির্বাচন করে দেখুন।",
    
    // Manual Area Selection
    select_area_placeholder: "বাংলাদেশর যেকোনো এলাকা নির্বাচন করুন...",
    quick_select_title: "অথবা প্রধান মেট্রোপলিটন এলাকা বেছে নিন:",

    // Missing Person Alert Network
    missing_person_title: "নিখোঁজ ব্যক্তি সন্ধান সতর্কতা",
    missing_person_badge: "🚨 নিখোঁজ ব্যক্তি",
    last_seen_near: "সর্বশেষ দেখা গেছে",
    last_seen_time: "সর্বশেষ দেখার সময়",
    identifying_details: "শনাক্তকারী বৈশিষ্ট্য",
    clothing: "পরনের পোশাক",
    age: "বয়স",
    gender: "লিঙ্গ",
    height: "উচ্চতা",
    contact_authority: "অফিসিয়াল যোগাযোগ",
    i_saw_this_person: "আমি এই ব্যক্তিকে দেখেছি",
    submit_sighting: "দেখার তথ্য জমা দিন",
    community_sightings: "যাচাইকৃত দেখার তথ্য",
    no_sightings: "এখনও কোনো তথ্য জমা পড়েনি। আপনার কাছে কোনো তথ্য থাকলে নিচের বাটনে ক্লিক করুন।",
    sighting_disclaimer: "🔒 আপনার তথ্যটি মডারেশন টিম দ্বারা যাচাইয়ের পরই অনুমোদিত হবে। আপনার কোনো ব্যক্তিগত তথ্য প্রকাশ করা হবে না।",
    approx_location_label: "যে এলাকায় দেখেছেন *",
    sighting_desc_label: "বিস্তারিত বিবরণ লিখুন *",
    sighting_time_label: "দেখার সময় বা তারিখ",
    status_active: "সন্ধান চলমান",
    status_found: "উদ্ধার হয়েছেন",
    status_expired: "মেয়াদোত্তীর্ণ",
    status_pending: "যাচাই প্রক্রিয়াধিন",
  },
};
