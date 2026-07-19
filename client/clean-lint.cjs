const fs = require('fs');
const path = require('path');

const replacements = [
  {
    file: 'src/components/student/ebook-reader/TableOfContents.jsx',
    fixes: [
      { from: "import React from 'react';\n", to: "" },
      { from: "import { X, BookOpen, ChevronRight, Menu } from 'lucide-react';", to: "import { X, BookOpen, ChevronRight } from 'lucide-react';" },
    ]
  },
  {
    file: 'src/components/student/facilities/ActiveReservationBanner.jsx',
    fixes: [
      { from: "import React from 'react';\n", to: "" }
    ]
  },
  {
    file: 'src/components/student/facilities/CancelModal.jsx',
    fixes: [
      { from: "import React from 'react';\n", to: "" }
    ]
  },
  {
    file: 'src/components/student/facilities/MyReservationsList.jsx',
    fixes: [
      { from: "import React, { useState } from 'react';", to: "import { useState } from 'react';" }
    ]
  },
  {
    file: 'src/components/student/facilities/ReservationModal.jsx',
    fixes: [
      { from: "import React, { useState } from 'react';", to: "import { useState } from 'react';" }
    ]
  },
  {
    file: 'src/components/student/facilities/WorkstationGrid.jsx',
    fixes: [
      { from: "import React from 'react';\n", to: "" }
    ]
  },
  {
    file: 'src/components/student/loans-tracker/FinesSummary.jsx',
    fixes: [
      { from: ", Calendar ", to: " " },
      { from: "Calendar, ", to: "" }
    ]
  },
  {
    file: 'src/components/student/loans-tracker/LoansList.jsx',
    fixes: [
      { from: "import { BookOpen, AlertCircle } from 'lucide-react';", to: "import { AlertCircle } from 'lucide-react';" }
    ]
  },
  {
    file: 'src/components/student/loans-tracker/QueueHoldsList.jsx',
    fixes: [
      { from: "import { Button } from '../../ui/Button';\n", to: "" }
    ]
  },
  {
    file: 'src/components/student/notifications/NotificationDrawer.jsx',
    fixes: [
      { from: ", Check ", to: " " },
      { from: "Check, ", to: "" }
    ]
  },
  {
    file: 'src/components/student/patron-card/CardBack.jsx',
    fixes: [
      { from: ", Smartphone", to: "" },
      { from: "isOnline,", to: "" },
      { from: "isOnline", to: "" }
    ]
  },
  {
    file: 'src/components/student/patron-card/CardFront.jsx',
    fixes: [
      { from: "import React from 'react';\n", to: "" },
      { from: "import { Book, CreditCard, Sparkles, QrCode, Wifi, ShieldCheck, User } from 'lucide-react';", to: "import { CreditCard, QrCode, Wifi, ShieldCheck, User } from 'lucide-react';" },
      { from: "isOnline,", to: "" },
      { from: "isOnline", to: "" }
    ]
  },
  {
    file: 'src/components/student/patron-card/PatronCardContainer.jsx',
    fixes: [
      { from: ", RefreshCw", to: "" },
      { from: ", HelpCircle", to: "" }
    ]
  },
  {
    file: 'src/components/student/patron-card/PatronCardSkeleton.jsx',
    fixes: [
      { from: "import React from 'react';\n", to: "" }
    ]
  },
  {
    file: 'src/components/student/streak/BadgeUnlockModal.jsx',
    fixes: [
      { from: "import confetti from 'canvas-confetti';\n", to: "" },
      { from: "import { Trophy, Award, Sparkles, Star, Check } from 'lucide-react';", to: "import { Trophy, Sparkles, Check } from 'lucide-react';" }
    ]
  },
  {
    file: 'src/components/student/support/FeedbackForm.jsx',
    fixes: [
      { from: "import React, { useState } from 'react';", to: "import { useState } from 'react';" }
    ]
  }
];

const clientDir = __dirname;

replacements.forEach(({ file, fixes }) => {
  const fullPath = path.join(clientDir, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    fixes.forEach(({ from, to }) => {
      content = content.replaceAll(from, to);
    });
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Cleaned ${file}`);
  }
});
