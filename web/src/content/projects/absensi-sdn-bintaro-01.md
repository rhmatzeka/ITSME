---
title: "SDN Bintaro 01 Attendance"
summary: "A web app an elementary school uses for daily student attendance: per-class check-ins, lesson notes, student records, and printable monthly reports."
stack: ["Next.js", "React", "TypeScript", "PostgreSQL", "Prisma", "NextAuth", "Tailwind CSS", "Bun"]
year: 2026
repo: "https://github.com/rhmatzeka/AppAbsensiSDN1Bintaro"
demo: "https://absensisdnbintaro01.com"
images: ["/img/projects/sdn-bintaro.webp", "/img/projects/sdn-bintaro-2.webp", "/img/projects/sdn-bintaro-3.webp"]
order: 1
---

Built for SDN Bintaro 01, a real elementary school, and live on its own
domain. Teachers take attendance per class and date — present, sick,
excused, or absent — with one click to mark the whole class present, and
the topic taught that day is saved alongside it so it shows up in reports.

There are two roles: admins manage every student, class, and account, while
teachers only see the classes assigned to them. Admins can import students
from CSV, move a whole class up a grade while keeping each student's class
history, and read the teachers' daily activity log.

Each student has a profile with a monthly attendance calendar and full
history, and the weekly and monthly recaps can be exported to CSV or printed
straight for the school's paperwork. Next.js 15 with the App Router,
PostgreSQL through Prisma, and NextAuth for sign-in.
