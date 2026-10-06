// Long-form descriptions and grouped specifications for the catalog, keyed by
// SKU. Applied by server/scripts/enrichProducts.js (description + specs only —
// never prices or stock) and used by the seed for fresh databases.
//
// Specs follow the manufacturers' published datasheets for the configuration
// listed in each product's short specs. Where a model ships in several
// configurations, the variable items say "on selected units" — confirm the
// exact unit with the team before promising a feature to a customer.

const OS_NOTE = 'Windows 11 Pro or FreeDOS units available — confirm with our team when ordering';

export const PRODUCT_DETAILS = {
  // -------------------------------------------------------------------------
  // Brand new laptops
  // -------------------------------------------------------------------------
  'HP-PB450G10': {
    description: `The HP ProBook 450 G10 is a full-size 15.6" business laptop built for people who work on spreadsheets, accounting packages and web apps all day. The 13th-generation Intel Core i5-1334U pairs performance and efficiency cores, so the machine stays quick with many browser tabs, Office and Teams open at once while still giving long battery life.

A full-size keyboard with a dedicated numeric keypad makes data entry comfortable, and the matte Full HD display cuts reflections in bright offices. The 512GB NVMe SSD boots in seconds and leaves plenty of room for files.

Business essentials are built in: a wired Ethernet port for the office network, HDMI for projectors and external monitors, USB-C, and HP's security tools including a TPM 2.0 chip for BitLocker encryption. It is brand new and sealed, with a 1-year HP warranty.

Ideal for: accountants, administrators, SMEs, schools and anyone who wants a dependable, larger-screen work laptop.`,
    specs: {
      Performance: {
        Processor: 'Intel Core i5-1334U (13th Gen, 10 cores / 12 threads, up to 4.6 GHz, 12 MB cache)',
        Memory: '8 GB DDR4-3200 (2 slots, upgradeable to 32 GB)',
        Storage: '512 GB PCIe NVMe M.2 SSD',
        Graphics: 'Intel Iris Xe Graphics (Intel UHD when memory is single-channel)'
      },
      Display: {
        Screen: '15.6" Full HD (1920 × 1080) IPS, anti-glare',
        Webcam: '720p HD camera with privacy shutter'
      },
      Connectivity: {
        Wireless: 'Wi-Fi 6/6E and Bluetooth 5.3 (by configuration)',
        Ports: 'USB-C, 2 × USB-A, HDMI, RJ-45 Ethernet, headphone/mic combo jack'
      },
      'Design & Input': {
        Keyboard: 'Full-size, spill-resistant with numeric keypad (backlit on selected units)',
        'Weight (approx.)': '1.8 kg'
      },
      'Security & Software': {
        Security: 'TPM 2.0, HP Sure Start firmware protection, fingerprint reader on selected units',
        'Operating system': OS_NOTE
      },
      'In the box': { Contents: 'Laptop, HP power adapter' }
    }
  },
  'DELL-LAT5440': {
    description: `The Dell Latitude 5440 is a 14" business laptop designed for professionals who travel between the office, client sites and home. It combines a 13th-generation Intel Core i7-1355U with 16GB of RAM, so heavy multitasking — large Excel models, video calls, ERP systems and dozens of browser tabs — stays smooth.

The compact chassis is light enough to carry daily, yet keeps the ports businesses still rely on: HDMI, Ethernet, USB-A and USB-C/Thunderbolt for docking stations. Dell's enterprise-grade security (TPM 2.0, optional fingerprint and smart-card readers) and manageability make it a favourite of IT departments.

Brand new and sealed, backed by Dell ProSupport for one year.

Ideal for: managers, consultants, sales teams and corporate fleets.`,
    specs: {
      Performance: {
        Processor: 'Intel Core i7-1355U (13th Gen, 10 cores / 12 threads, up to 5.0 GHz, 12 MB cache)',
        Memory: '16 GB DDR4-3200',
        Storage: '512 GB PCIe NVMe M.2 SSD',
        Graphics: 'Intel Iris Xe Graphics'
      },
      Display: {
        Screen: '14" Full HD (1920 × 1080) anti-glare',
        Webcam: 'FHD/HD camera with privacy shutter (by configuration)'
      },
      Connectivity: {
        Wireless: 'Wi-Fi 6E, Bluetooth 5.3',
        Ports: 'USB-C with Thunderbolt 4 (on selected units), USB-A, HDMI, RJ-45 Ethernet, audio jack'
      },
      'Design & Input': {
        Keyboard: 'Full-size, backlit on selected units',
        'Weight (approx.)': '1.4 kg'
      },
      'Security & Software': {
        Security: 'TPM 2.0; fingerprint and smart-card reader options',
        'Operating system': OS_NOTE
      },
      Warranty: { Coverage: '1 Year Dell ProSupport' }
    }
  },
  'LEN-E14G5': {
    description: `The Lenovo ThinkPad E14 Gen 5 brings ThinkPad reliability and the famous ThinkPad keyboard to an everyday office budget. Its 13th-generation Intel Core i5-1335U handles Office, email, accounting software and video calls with ease.

The 14" Full HD screen uses a taller-than-usual layout on many units, giving more room for documents, and the aluminium top cover and MIL-STD tested design mean it copes with daily commuting. A fast NVMe SSD keeps start-up and file opening quick, and RAM can be upgraded later as your work grows.

Brand new and sealed with a 1-year Lenovo warranty.

Ideal for: small businesses, students, teachers and home-office users who want ThinkPad durability without the premium price.`,
    specs: {
      Performance: {
        Processor: 'Intel Core i5-1335U (13th Gen, 10 cores / 12 threads, up to 4.6 GHz, 12 MB cache)',
        Memory: '8 GB DDR4-3200 (upgradeable)',
        Storage: '256 GB PCIe NVMe M.2 SSD (second M.2 slot on selected units)',
        Graphics: 'Intel Iris Xe Graphics'
      },
      Display: {
        Screen: '14" Full HD IPS, anti-glare',
        Webcam: '1080p/720p camera with ThinkShutter privacy cover'
      },
      Connectivity: {
        Wireless: 'Wi-Fi 6, Bluetooth 5.x',
        Ports: 'USB-C, USB-A, HDMI, RJ-45 Ethernet, audio jack'
      },
      'Design & Input': {
        Keyboard: 'ThinkPad spill-resistant keyboard (backlit on selected units)',
        Build: 'Aluminium top cover',
        'Weight (approx.)': '1.4 kg'
      },
      'Security & Software': {
        Security: 'TPM 2.0, fingerprint reader in power button on selected units',
        'Operating system': OS_NOTE
      }
    }
  },
  'HP-EB840G9': {
    description: `The HP EliteBook 840 G9 is HP's premium 14" business ultrabook, made for executives and professionals who want speed, security and a refined design. The 12th-generation Intel Core i7-1265U with vPro support and 16GB of RAM handle demanding multitasking, while the 512GB SSD keeps everything responsive.

The Full HD touch display makes presenting and annotating easy, and the aluminium chassis is slim, rigid and light. EliteBooks are built for video meetings, with a quality webcam, noise-reducing microphones and Bang & Olufsen–tuned audio.

Enterprise security comes standard: HP Wolf Security, HP Sure Start BIOS protection and TPM 2.0. Brand new and sealed, with a 1-year HP warranty.

Ideal for: executives, senior managers, lawyers, consultants and anyone presenting to clients.`,
    specs: {
      Performance: {
        Processor: 'Intel Core i7-1265U vPro (12th Gen, 10 cores / 12 threads, up to 4.8 GHz, 12 MB cache)',
        Memory: '16 GB DDR5',
        Storage: '512 GB PCIe NVMe SSD',
        Graphics: 'Intel Iris Xe Graphics'
      },
      Display: {
        Screen: '14" Full HD (1920 × 1200 on WUXGA units) touchscreen',
        Webcam: 'HD/5MP camera with privacy shutter (by configuration)'
      },
      Connectivity: {
        Wireless: 'Wi-Fi 6E, Bluetooth 5.3',
        Ports: '2 × Thunderbolt 4 USB-C, 2 × USB-A, HDMI 2.0, audio jack'
      },
      'Design & Input': {
        Build: 'Aluminium chassis',
        Keyboard: 'Backlit, spill-resistant',
        Audio: 'Bang & Olufsen stereo speakers',
        'Weight (approx.)': '1.4 kg'
      },
      'Security & Software': {
        Security: 'HP Wolf Security, HP Sure Start, TPM 2.0, fingerprint reader',
        'Operating system': OS_NOTE
      }
    }
  },

  // -------------------------------------------------------------------------
  // Ex-UK laptops
  // -------------------------------------------------------------------------
  'HP-EB840G5-UK': {
    description: `A premium business laptop at a fraction of the new price. This HP EliteBook 840 G5 is a Grade A ex-UK unit: it has been fully tested, cleaned and inspected by our technicians, and shows only minimal signs of previous use.

The Intel Core i5-8350U (quad-core, 8th Gen) and SSD storage make it quick for Office, browsing, Zoom/Teams and accounting software. Its slim aluminium body and 14" Full HD screen make it comfortable to carry and use all day.

Every unit is battery-checked, gets a fresh operating system installation, and comes with a 6-month Internext warranty.

Ideal for: students, startups and staff laptops where value matters but build quality still counts.`,
    specs: {
      Performance: {
        Processor: 'Intel Core i5-8350U (8th Gen, 4 cores / 8 threads, up to 3.6 GHz)',
        Memory: '8 GB DDR4 (upgradeable to 32 GB)',
        Storage: '256 GB SSD',
        Graphics: 'Intel UHD Graphics 620'
      },
      Display: { Screen: '14" Full HD (1920 × 1080), anti-glare' },
      Connectivity: {
        Wireless: 'Wi-Fi 5 (802.11ac), Bluetooth 4.2',
        Ports: 'USB-C (Thunderbolt 3), 2 × USB-A 3.1, HDMI, docking connector, audio jack'
      },
      'Design & Input': {
        Build: 'Aluminium chassis',
        Keyboard: 'Backlit on most units',
        'Weight (approx.)': '1.5 kg'
      },
      Condition: {
        Grade: 'Ex-UK Grade A — minimal cosmetic wear',
        'Our checks': 'Full hardware test, battery health check, deep clean, fresh OS install',
        Charger: 'Compatible charger included'
      }
    }
  },
  'DELL-LAT7490-UK': {
    description: `The Dell Latitude 7490 was a top-tier corporate laptop, and this Grade A ex-UK unit brings that class to an everyday budget. With an 8th-gen quad-core Core i7-8650U, 16GB RAM and a 512GB SSD, it handles heavy multitasking, large spreadsheets and multiple monitors easily.

It is light (about 1.4 kg), has an excellent backlit keyboard, and keeps business ports such as HDMI, Ethernet and USB-C. Each unit is tested end-to-end, cleaned, battery-checked and given a fresh operating system by our technicians.

Covered by a 6-month Internext warranty.

Ideal for: power users, finance teams and anyone who needs high specs without paying new-laptop prices.`,
    specs: {
      Performance: {
        Processor: 'Intel Core i7-8650U (8th Gen, 4 cores / 8 threads, up to 4.2 GHz, vPro)',
        Memory: '16 GB DDR4',
        Storage: '512 GB SSD',
        Graphics: 'Intel UHD Graphics 620'
      },
      Display: { Screen: '14" Full HD (1920 × 1080), anti-glare' },
      Connectivity: {
        Wireless: 'Wi-Fi 5 (802.11ac), Bluetooth 4.2',
        Ports: 'USB-C (Thunderbolt 3), 3 × USB-A 3.1, HDMI, RJ-45 Ethernet, audio jack, microSD'
      },
      'Design & Input': { Keyboard: 'Backlit', 'Weight (approx.)': '1.4 kg' },
      Condition: {
        Grade: 'Ex-UK Grade A — minimal cosmetic wear',
        'Our checks': 'Full hardware test, battery health check, deep clean, fresh OS install',
        Charger: 'Compatible charger included'
      }
    }
  },
  'LEN-T480-UK': {
    description: `The ThinkPad T480 is one of the most popular ex-UK laptops in Kenya — and for good reason. It is tough, easy to repair, and has one of the best keyboards ever put in a laptop.

This Grade A unit runs an 8th-gen quad-core Intel Core i5-8350U with 8GB RAM and an SSD, making it quick for Office, browsing and video calls. A standout feature is its dual-battery design (internal plus swappable rear battery on most units), which can give a full working day away from the socket.

Every unit is tested, cleaned and battery-checked, and comes with a 6-month Internext warranty.

Ideal for: students, field staff and anyone who needs a durable, long-lasting work laptop.`,
    specs: {
      Performance: {
        Processor: 'Intel Core i5-8350U (8th Gen, 4 cores / 8 threads, up to 3.6 GHz)',
        Memory: '8 GB DDR4 (2 slots, upgradeable to 32 GB)',
        Storage: '256 GB SSD',
        Graphics: 'Intel UHD Graphics 620'
      },
      Display: { Screen: '14" Full HD (1920 × 1080) IPS' },
      Connectivity: {
        Wireless: 'Wi-Fi 5 (802.11ac), Bluetooth 4.1',
        Ports: 'USB-C (Thunderbolt 3), 2 × USB-A 3.1, HDMI, RJ-45 Ethernet, SD card reader, audio jack'
      },
      'Design & Input': {
        Keyboard: 'ThinkPad spill-resistant keyboard with TrackPoint',
        Battery: 'Power Bridge dual battery (internal + removable rear) on most units',
        'Weight (approx.)': '1.6 kg'
      },
      Condition: {
        Grade: 'Ex-UK Grade A — minimal cosmetic wear',
        'Our checks': 'Full hardware test, battery health check, deep clean, fresh OS install',
        Charger: 'Compatible charger included'
      }
    }
  },
  'HP-PB640G4-UK': {
    description: `A dependable entry-level work laptop. This HP ProBook 640 G4 (ex-UK, Grade B) has an 8th-gen Intel Core i5-8250U quad-core processor and 8GB RAM — plenty for email, Office documents, browsing and online classes.

Grade B means the laptop works perfectly but shows visible cosmetic wear such as scuffs or light scratches. Storage is a 500GB hard disk; ask us about upgrading to an SSD at checkout for much faster start-up.

Tested, cleaned and set up by our technicians, with a 3-month Internext warranty.

Ideal for: tight budgets, first laptops, and general office or school use.`,
    specs: {
      Performance: {
        Processor: 'Intel Core i5-8250U (8th Gen, 4 cores / 8 threads, up to 3.4 GHz)',
        Memory: '8 GB DDR4 (upgradeable)',
        Storage: '500 GB HDD (SSD upgrade available)',
        Graphics: 'Intel UHD Graphics 620'
      },
      Display: { Screen: '14" HD (1366 × 768)' },
      Connectivity: {
        Wireless: 'Wi-Fi 5, Bluetooth',
        Ports: 'USB-C, USB-A 3.1, HDMI, VGA, RJ-45 Ethernet, audio jack'
      },
      Condition: {
        Grade: 'Ex-UK Grade B — fully working, visible cosmetic wear',
        'Our checks': 'Full hardware test, battery check, clean, fresh OS install',
        Charger: 'Compatible charger included'
      }
    }
  },

  // -------------------------------------------------------------------------
  // Desktops
  // -------------------------------------------------------------------------
  'HP-ED800G4': {
    description: `The HP EliteDesk 800 G4 Small Form Factor is a compact, quiet office PC that fits on or under any desk. A 6-core 8th-gen Intel Core i5-8500 and SSD storage make it fast for Office, accounting systems, ERP and browser-based work.

It supports up to three displays, has plenty of USB ports for peripherals, and is easy to upgrade with more memory or storage later. HP business-class reliability and security features (TPM 2.0, HP Sure Start) make it suitable for corporate networks.

Monitor, keyboard and mouse are sold separately — ask us for a bundle price.

Ideal for: reception desks, accounts offices, schools and computer labs.`,
    specs: {
      Performance: {
        Processor: 'Intel Core i5-8500 (8th Gen, 6 cores / 6 threads, up to 4.1 GHz)',
        Memory: '8 GB DDR4 (4 slots, upgradeable to 64 GB)',
        Storage: '256 GB SSD',
        Graphics: 'Intel UHD Graphics 630'
      },
      Connectivity: {
        'Video outputs': '2 × DisplayPort, VGA/HDMI by configuration',
        Ports: 'Front and rear USB 3.1 / USB 2.0, RJ-45 Gigabit Ethernet, audio jacks'
      },
      Design: { 'Form factor': 'Small Form Factor (SFF)', 'Expansion': 'Low-profile PCIe slots' },
      'Security & Software': { Security: 'TPM 2.0, HP Sure Start', 'Operating system': OS_NOTE },
      'In the box': { Contents: 'System unit, power cable (monitor, keyboard and mouse sold separately)' }
    }
  },
  'DELL-OP7080': {
    description: `The Dell OptiPlex 7080 Micro Tower is a powerful business desktop for demanding work. Its 8-core / 16-thread 10th-gen Intel Core i7-10700, 16GB RAM and 512GB SSD handle large spreadsheets, accounting databases, light design work and heavy multitasking without slowing down.

The tower has room to grow — extra memory slots, drive bays and PCIe slots for a graphics card or network card — and supports multiple monitors. Dell's business features (TPM 2.0, remote management) make it easy to deploy across an office.

Monitor, keyboard and mouse are sold separately — ask us for a bundle.

Ideal for: finance and design teams, power users and small servers/workstations.`,
    specs: {
      Performance: {
        Processor: 'Intel Core i7-10700 (10th Gen, 8 cores / 16 threads, up to 4.8 GHz, 16 MB cache)',
        Memory: '16 GB DDR4 (upgradeable to 128 GB)',
        Storage: '512 GB NVMe SSD (extra drive bays available)',
        Graphics: 'Intel UHD Graphics 630 (PCIe slot for a dedicated card)'
      },
      Connectivity: {
        'Video outputs': '2 × DisplayPort, HDMI (by configuration)',
        Ports: 'Multiple front/rear USB 3.2 and USB 2.0, RJ-45 Gigabit Ethernet, audio'
      },
      Design: { 'Form factor': 'Micro Tower' },
      'Security & Software': { Security: 'TPM 2.0', 'Operating system': OS_NOTE },
      'In the box': { Contents: 'System unit, power cable (monitor, keyboard and mouse sold separately)' }
    }
  },
  'INX-OFFICE-I3': {
    description: `Assembled and burn-in tested by the Internext workshop, this office desktop is a reliable, affordable workhorse for everyday tasks — typing, email, browsing, POS systems and accounting software.

It uses a quad-core 10th-gen Intel Core i3-10100 with 8GB RAM. Because we build it ourselves, it is easy to upgrade: add an SSD for faster start-up, more RAM, or Wi-Fi — just ask when ordering. Parts are standard and readily available in Kenya, keeping future repairs cheap.

Covered by a 1-year Internext warranty, serviced at our Nairobi workshop.

Ideal for: schools, cyber cafés, shops, reception desks and small offices.`,
    specs: {
      Performance: {
        Processor: 'Intel Core i3-10100 (10th Gen, 4 cores / 8 threads, up to 4.3 GHz)',
        Memory: '8 GB DDR4',
        Storage: '500 GB HDD (SSD upgrade available)',
        Graphics: 'Intel UHD Graphics 630'
      },
      Connectivity: { Ports: 'USB 3.x and USB 2.0, HDMI/VGA, RJ-45 Ethernet, audio' },
      Build: { Assembly: 'Built and stress-tested in-house by Internext', Upgrades: 'SSD, RAM and Wi-Fi upgrades on request' },
      Warranty: { Coverage: '1 Year Internext warranty, Nairobi workshop' }
    }
  },

  // -------------------------------------------------------------------------
  // Accessories
  // -------------------------------------------------------------------------
  'LOG-MK270': {
    description: `The Logitech MK270 is a simple, dependable wireless keyboard and mouse set for the home or office. A single tiny USB receiver connects both devices, freeing a port and cutting desk clutter.

The full-size keyboard includes a number pad and 8 hotkeys for media, email and the web, and has a spill-resistant design. The compact mouse fits either hand. Battery life is excellent — up to 24 months for the keyboard and 12 months for the mouse (usage dependent).

Works with Windows, ChromeOS and most Linux systems — plug in and type, no software needed.`,
    specs: {
      General: { Connection: '2.4 GHz wireless, single USB receiver (included)', Range: 'Up to 10 m' },
      Keyboard: { Layout: 'Full-size with number pad', 'Hot keys': '8 shortcut keys', Durability: 'Spill-resistant design', Battery: '2 × AAA (included), up to 24 months' },
      Mouse: { Type: 'Compact optical, ambidextrous', Battery: '1 × AA (included), up to 12 months' },
      Compatibility: { Systems: 'Windows, ChromeOS, Linux' }
    }
  },
  'HP-CHG65W': {
    description: `A universal 65W laptop charger with multiple interchangeable tips, so one adapter can power most HP, Dell and Lenovo business laptops and ultrabooks.

It delivers stable, regulated power with protection against over-voltage, over-current and short circuits. Great as a replacement for a lost or damaged charger, or as a spare for the office.

Not sure which tip you need? Send us your laptop model on WhatsApp and we'll confirm compatibility before you buy.`,
    specs: {
      Electrical: { 'Output power': '65 W', Input: '100–240 V AC, 50/60 Hz (works on Kenyan mains)', Protection: 'Over-voltage, over-current and short-circuit protection' },
      Compatibility: { Tips: 'Multiple interchangeable tips included', Brands: 'Most HP, Dell and Lenovo laptops rated 65 W or lower' },
      'In the box': { Contents: 'Adapter, power cable, assorted tips' }
    }
  },
  'TGT-BAG156': {
    description: `A durable everyday laptop bag with a padded compartment that protects laptops up to 15.6". Separate organiser pockets keep your charger, mouse, cables, phone and documents in order.

The water-resistant outer fabric helps keep your gear dry in light rain, and the padded shoulder strap plus carry handle make it comfortable on the commute.`,
    specs: {
      Capacity: { 'Laptop size': 'Up to 15.6"', Compartments: 'Padded laptop sleeve, main compartment, front organiser pockets' },
      Build: { Material: 'Water-resistant fabric', Carry: 'Padded shoulder strap and top handle' }
    }
  },
  'DELL-MON24': {
    description: `A crisp 24" Full HD IPS monitor from Dell, ideal for office work and light design. IPS technology gives accurate, consistent colours and wide viewing angles, so text and images look right even from the side.

Both HDMI and VGA inputs mean it connects to modern laptops and older desktops alike. Thin bezels make it a great choice for dual-monitor setups, and the matte screen reduces glare. Comfort features such as flicker-free backlighting help reduce eye strain over long working days.

Brand new and sealed, with a 1-year Dell warranty.`,
    specs: {
      Display: { Size: '24" (23.8" viewable)', Resolution: 'Full HD 1920 × 1080', Panel: 'IPS, anti-glare', 'Refresh rate': '60 Hz (75 Hz on selected models)' },
      Connectivity: { Inputs: 'HDMI, VGA' },
      Comfort: { 'Eye care': 'Flicker-free with low blue light mode', Mounting: 'VESA mount compatible on most models' },
      'In the box': { Contents: 'Monitor, stand, power cable, video cable' }
    }
  },

  // -------------------------------------------------------------------------
  // Components
  // -------------------------------------------------------------------------
  'KGN-8GB-DDR4': {
    description: `Give a slow computer a new lease of life with an extra 8GB of Kingston DDR4 memory. More RAM lets you keep more programs and browser tabs open without the machine freezing or slowing down.

This module runs at 2666 MT/s and is backed by Kingston's lifetime warranty. Kingston tests every module for compatibility and reliability.

Important: laptops use SO-DIMM and desktops use DIMM modules. Tell us your computer model and we'll confirm the right type — we can also install it for you.`,
    specs: {
      Memory: { Capacity: '8 GB', Type: 'DDR4', Speed: '2666 MT/s', Voltage: '1.2 V' },
      Compatibility: { 'Form factor': 'SO-DIMM (laptop) or DIMM (desktop) — confirm when ordering' },
      Warranty: { Coverage: 'Lifetime limited Kingston warranty' }
    }
  },
  'CRU-480-SSD': {
    description: `The single most effective upgrade for an older laptop or desktop. Replacing a hard disk with this 480GB SATA SSD typically cuts start-up time from minutes to seconds and makes programs open almost instantly.

It uses the standard 2.5" SATA III format, so it fits most laptops and desktops. SSDs have no moving parts, which also makes them quieter, cooler and more resistant to bumps.

Our technicians can clone your existing drive — keeping all your files and programs — when we install it. 3-year warranty.`,
    specs: {
      Storage: { Capacity: '480 GB', Interface: 'SATA III 6 Gb/s', 'Form factor': '2.5" (7 mm)', 'Read speed': 'Up to ~500 MB/s (sequential)' },
      Compatibility: { Fits: 'Most laptops and desktops with a 2.5" SATA bay' },
      Service: { Installation: 'Installation and data cloning available at our workshop' },
      Warranty: { Coverage: '3 years' }
    }
  },
  'APC-BU650': {
    description: `Kenyan power blinks and outages can corrupt files and damage equipment. The APC Back-UPS 650VA keeps a desktop computer, router or small network running through short interruptions, giving you time to save your work and shut down safely.

It also protects connected equipment from surges and spikes. Automatic voltage regulation (AVR) on supported models corrects low and high voltage without draining the battery.

Brand new and sealed with a 1-year APC warranty.`,
    specs: {
      Power: { Capacity: '650 VA / 360 W', Input: '230 V nominal', Protection: 'Surge and spike protection; AVR on supported models' },
      Runtime: { 'Typical backup': 'Several minutes for a desktop PC and monitor — enough to save and shut down; longer for a router alone' },
      Outlets: { Sockets: 'Battery-backed outlets (configuration varies by model)' },
      Warranty: { Coverage: '1 Year APC warranty' }
    }
  },

  // -------------------------------------------------------------------------
  // Networking
  // -------------------------------------------------------------------------
  'TPL-C6': {
    description: `The TP-Link Archer C6 is a fast, reliable dual-band Wi-Fi router for homes and small offices. Two bands — 2.4 GHz for range and 5 GHz for speed — deliver combined Wi-Fi speeds of up to 1200 Mbps (867 + 300 Mbps).

Four external antennas plus an internal one and MU-MIMO technology spread coverage around the house or office and serve several devices at once. Four Gigabit LAN ports connect desktops, printers and smart TVs by cable.

Set-up takes minutes with the TP-Link Tether app. Works with Safaricom, Zuku, Faiba and other fibre providers (as the main router or as an access point).`,
    specs: {
      Wireless: { Standard: 'AC1200 dual-band (Wi-Fi 5)', Speeds: '867 Mbps (5 GHz) + 300 Mbps (2.4 GHz)', Antennas: '4 external + 1 internal', Features: 'MU-MIMO, beamforming' },
      Ports: { WAN: '1 × Gigabit', LAN: '4 × Gigabit' },
      Management: { 'Set-up': 'TP-Link Tether app or web interface', Modes: 'Router / Access Point' },
      Warranty: { Coverage: '2 Year TP-Link warranty' }
    }
  },
  'UBQ-APACLITE': {
    description: `The Ubiquiti UniFi AP AC Lite is an enterprise-grade ceiling or wall-mounted Wi-Fi access point, perfect for offices, hotels, schools and churches that need strong, managed coverage.

Dual-band 2×2 MIMO 802.11ac delivers up to 867 Mbps on 5 GHz and 300 Mbps on 2.4 GHz. Multiple access points can be managed together from the free UniFi Network controller, with guest networks, seamless roaming and usage statistics.

It is powered over the network cable (PoE) — no socket needed at the mounting point. Our team can design and install a full UniFi network for your premises.`,
    specs: {
      Wireless: { Standard: '802.11ac (Wi-Fi 5) dual-band', 'MIMO': '2×2', Speeds: '867 Mbps (5 GHz) + 300 Mbps (2.4 GHz)' },
      Power: { Method: '24 V passive PoE (PoE adapter included)' },
      Management: { Controller: 'UniFi Network application (free)', Features: 'Guest portal, VLANs, multiple SSIDs, roaming' },
      Installation: { Mounting: 'Ceiling or wall (mount kit included)', Port: '1 × Gigabit Ethernet' },
      Warranty: { Coverage: '1 Year Ubiquiti warranty' }
    }
  },
  'TPL-SW24': {
    description: `A 24-port Gigabit switch for growing office networks. Every port runs at up to 1000 Mbps, giving fast file transfers and smooth connections for computers, printers, IP phones and access points.

It is unmanaged — plug-and-play with no configuration — and rack-mountable in a standard 19" cabinet, making it a natural fit for structured cabling projects.`,
    specs: {
      Ports: { Count: '24 × 10/100/1000 Mbps RJ-45', 'Auto features': 'Auto-negotiation, auto MDI/MDIX' },
      Management: { Type: 'Unmanaged, plug-and-play' },
      Installation: { Mounting: '19" rack-mountable or desktop' },
      Warranty: { Coverage: '2 Year TP-Link warranty' }
    }
  },

  // -------------------------------------------------------------------------
  // Structured cabling
  // -------------------------------------------------------------------------
  'CAB-CAT6-305': {
    description: `A full 305 m box of Cat6 UTP network cable with solid copper conductors — the right choice for permanent office installations. Cat6 supports Gigabit Ethernet comfortably and 10 Gigabit over shorter runs.

Solid copper (not copper-clad aluminium) gives reliable performance, proper PoE power delivery for cameras and access points, and passes certification testing.`,
    specs: {
      Cable: { Category: 'Cat6 UTP', Conductors: 'Solid bare copper, 23 AWG (typical)', Length: '305 m box' },
      Performance: { Bandwidth: 'Up to 250 MHz', Supports: 'Gigabit Ethernet; 10GBASE-T on short runs; PoE' },
      Use: { Application: 'Permanent in-wall / trunking installations' }
    }
  },
  'SVC-CABLE-POINT': {
    description: `Professional installation of a network data point, priced per point. Each point is run neatly in trunking or conduit, terminated on a faceplate and patch panel, labelled, and tested so you know it works before we leave.

Ideal for new offices, extensions, or adding points for extra desks, printers, cameras or access points. Price assumes standard runs; long distances, ceilings or civil works are quoted after a site visit.`,
    specs: {
      'What is included': {
        Cabling: 'Cat6 cable run in trunking/conduit',
        Termination: 'Faceplate and patch-panel termination',
        Testing: 'Every point tested and labelled'
      },
      Terms: { Pricing: 'Per data point; site survey for large jobs', Warranty: '90-day workmanship warranty' }
    }
  },
  'SVC-NET-DESIGN': {
    description: `Get the network right the first time. Our engineers visit your premises, assess the layout, user numbers and internet needs, and design a network that fits — data point positions, cabinet location, switching, Wi-Fi coverage and security.

You receive a written design and itemised quotation you can use for budgeting or tendering. If you go ahead with Internext for the installation, we will discuss crediting part of the consultation fee.`,
    specs: {
      'What is included': {
        'Site survey': 'On-site assessment of layout and requirements',
        Design: 'Point layout, cabinet, switching and Wi-Fi plan',
        Deliverable: 'Written design and itemised quotation'
      },
      Terms: { Coverage: 'Nairobi (other areas on request)' }
    }
  },
  'SVC-NET-IMPL-20': {
    description: `A complete, turnkey office network for up to 20 data points. We plan, supply and install everything: structured cabling, a network cabinet with patch panel, a Gigabit switch, Wi-Fi access points and the connection to your internet provider.

The job finishes with testing, labelling and a hand-over document so your team knows what is where. Ideal for new or relocating offices that want a tidy, reliable network from day one.`,
    specs: {
      'What is included': {
        Planning: 'Site survey and network design',
        Cabling: 'Up to 20 Cat6 data points, terminated and tested',
        Equipment: 'Cabinet, patch panel, Gigabit switch and Wi-Fi access points',
        'Hand-over': 'Labelling and documentation'
      },
      Terms: { Warranty: '1-year workmanship warranty; equipment carries manufacturer warranty', Timeline: 'Agreed after the site survey' }
    }
  },

  // -------------------------------------------------------------------------
  // CCTV
  // -------------------------------------------------------------------------
  'HIK-4CH-KIT': {
    description: `A complete starter CCTV kit from Hikvision for homes, shops and small offices. It includes four HD cameras with infrared night vision and a 4-channel DVR with a 1TB hard disk for continuous recording.

View live and recorded footage on your phone anywhere using the free Hik-Connect app, and get motion alerts. Recording time on 1TB depends on resolution and motion; typically one to two weeks of footage before it overwrites the oldest.

Add professional installation (per camera) for a neat, weather-proofed set-up. 2-year Hikvision warranty.`,
    specs: {
      Kit: { Cameras: '4 × HD turret/bullet cameras with IR night vision', Recorder: '4-channel Turbo HD DVR', Storage: '1 TB surveillance HDD (installed)' },
      Features: { 'Remote viewing': 'Hik-Connect app (Android/iOS) and PC', Alerts: 'Motion detection notifications', Weather: 'Outdoor-rated cameras (IP66/IP67 depending on model)' },
      Warranty: { Coverage: '2 Year Hikvision warranty' }
    }
  },
  'DAH-8CH-KIT': {
    description: `A professional 8-camera IP surveillance system from Dahua for medium-sized offices, schools, warehouses and residential compounds. IP cameras record sharper images than analogue systems, making faces and number plates easier to identify.

The NVR supports PoE, so each camera runs on one network cable for both power and video. The included 2TB drive provides around two weeks of recording for a typical set-up. Watch live, play back and export clips from the DMSS mobile app.

Our team can survey your site, position cameras for the best coverage and handle the full installation. 2-year Dahua warranty.`,
    specs: {
      Kit: { Cameras: '8 × IP cameras with IR night vision', Recorder: '8-channel PoE NVR', Storage: '2 TB surveillance HDD (installed)' },
      Features: { Power: 'PoE — one cable per camera', 'Remote viewing': 'DMSS app (Android/iOS) and PC', 'Smart features': 'Motion detection; smart events on supported models' },
      Warranty: { Coverage: '2 Year Dahua warranty' }
    }
  },
  'HIK-2MP-DOME': {
    description: `A 2MP Full HD dome camera to add coverage to an existing Hikvision system or extend a kit. Infrared night vision keeps recording in the dark, and the IP66-rated housing withstands dust and rain for indoor or sheltered outdoor use.

The discreet dome shape suits receptions, corridors and shop floors. Tell us your recorder model and we'll confirm compatibility.`,
    specs: {
      Camera: { Resolution: '2 MP (1080p Full HD)', 'Night vision': 'Infrared (IR)', Housing: 'Dome, IP66' },
      Compatibility: { Recorders: 'Hikvision DVR/NVR — confirm model with our team' },
      Warranty: { Coverage: '2 Year Hikvision warranty' }
    }
  },
  'SVC-CCTV-INSTALL': {
    description: `Professional CCTV installation priced per camera. Our technicians mount and aim each camera, run and conceal the cable, connect and configure the recorder, and set up mobile viewing on your phone before we leave.

Price covers standard installations; very long cable runs, high mounting points or civil works are quoted after a site visit.`,
    specs: {
      'What is included': {
        Mounting: 'Camera mounting and positioning for best coverage',
        Cabling: 'Cable run with neat concealment',
        Configuration: 'Recorder set-up, recording schedule and mobile app viewing'
      },
      Terms: { Pricing: 'Per camera', Warranty: '90-day workmanship warranty' }
    }
  },

  // -------------------------------------------------------------------------
  // Repairs & services
  // -------------------------------------------------------------------------
  'SVC-SCR-1314': {
    description: `Cracked, flickering or dead-pixel laptop screen? We replace 13"–14" laptop screens for most brands with a quality compatible panel matched to your model's connector and resolution.

Most replacements are done the same or next working day once the part is confirmed. Bring the laptop to our workshop or arrange a pickup.`,
    specs: {
      Service: { 'Screen sizes': '13" to 14"', Brands: 'HP, Dell, Lenovo, Acer, Asus and more', Turnaround: 'Typically same/next working day (part dependent)' },
      Terms: { Warranty: '90-day parts warranty (excludes new physical damage)' }
    }
  },
  'SVC-SCR-1517': {
    description: `Professional replacement for cracked or faulty 15"–17" laptop screens, for most brands. We source a compatible panel matched to your model, fit it, and test it before hand-over.

Bring the laptop to our workshop or arrange a pickup; we'll confirm the exact part and timeline first.`,
    specs: {
      Service: { 'Screen sizes': '15" to 17"', Brands: 'HP, Dell, Lenovo, Acer, Asus and more', Turnaround: 'Typically same/next working day (part dependent)' },
      Terms: { Warranty: '90-day parts warranty (excludes new physical damage)' }
    }
  },
  'SVC-MON-REPAIR': {
    description: `Repair service for desktop monitors with no display, dim or flickering backlight, lines on the screen, or power problems. The fee includes a full diagnosis; we confirm the repair cost before doing any work.`,
    specs: {
      Service: { Covers: 'Backlight, power board, panel and connection faults', Diagnosis: 'Included' },
      Terms: { Warranty: '30-day workmanship warranty' }
    }
  },
  'SVC-HW-DIAG': {
    description: `Laptop or desktop not starting, overheating, shutting down, or making noises? Our technicians run a full hardware diagnostic to find the fault, then explain the fix and cost before we proceed.

Common repairs include charging ports, keyboards, fans and thermal paste, RAM and storage, and motherboard-level faults.`,
    specs: {
      Service: { Diagnosis: 'Full hardware diagnostic', Covers: 'Power, overheating, keyboard, ports, storage, memory and board faults' },
      Terms: { Quotation: 'Repair cost confirmed before any work', Warranty: '30-day workmanship warranty' }
    }
  },
  'SVC-HW-CONTRACT': {
    description: `Keep office computers running smoothly all year with scheduled preventive maintenance. Each quarter our technician cleans, inspects and tests your machines, catching failing drives, overheating and worn batteries before they cause downtime.

Priced per device per year, with priority response if something breaks between visits.`,
    specs: {
      'What is included': { Visits: 'Quarterly preventive maintenance', Work: 'Internal cleaning, hardware health checks, thermal maintenance', Support: 'Priority response for breakdowns' },
      Terms: { Duration: '12 months', Pricing: 'Per device' }
    }
  },
  'SVC-SW-SETUP': {
    description: `A clean, fast start for your computer. We install the operating system, all drivers and updates, and essential software — office suite, browser, PDF reader and antivirus — and set up email if needed.

We back up your files first where possible. Software licences you supply are activated; genuine licences can be purchased from us.`,
    specs: {
      'What is included': { 'Operating system': 'Clean Windows installation with drivers and updates', Software: 'Office suite, browser, PDF reader, antivirus', Data: 'File backup and restore where possible' },
      Terms: { Support: '7-day support after setup' }
    }
  },
  'SVC-SW-CLEANUP': {
    description: `Is your computer slow, full of pop-ups, or acting strangely? We remove viruses and malware, clear unwanted start-up programs, and tune the system back to full speed — without losing your files.

We finish with a security check-up and advice on keeping the machine clean.`,
    specs: {
      'What is included': { Scan: 'Full malware and virus removal', Optimisation: 'Start-up clean-up, updates, disk health check', Data: 'Files preserved' },
      Terms: { Support: '7-day support after service' }
    }
  },
  'SVC-SW-CONTRACT': {
    description: `Ongoing software care for business computers: we keep operating systems and applications patched, monitor antivirus status, and give your staff remote support when something goes wrong.

Priced per device per year — a predictable cost instead of paying per call-out.`,
    specs: {
      'What is included': { Updates: 'OS and application patching', Security: 'Antivirus monitoring', Support: 'Remote support for staff' },
      Terms: { Duration: '12 months', Pricing: 'Per device' }
    }
  },

  // -------------------------------------------------------------------------
  // Office supplies
  // -------------------------------------------------------------------------
  'HP-M404DN': {
    description: `The HP LaserJet Pro M404dn is a fast, reliable black-and-white laser printer for busy offices. It prints up to 38 pages per minute, has automatic two-sided (duplex) printing to save paper, and connects to the office network via Ethernet so everyone can print to it.

HP JetIntelligence toner cartridges give sharp text and dependable page yields, and the 250-sheet tray plus 100-sheet multipurpose tray reduce paper refills. Built-in security features help protect documents on the network.

Brand new and sealed with a 1-year HP warranty.`,
    specs: {
      Printing: { Technology: 'Monochrome laser', Speed: 'Up to 38 ppm (A4)', Duplex: 'Automatic two-sided printing', 'First page out': 'As fast as ~6 seconds' },
      'Paper handling': { Input: '250-sheet tray + 100-sheet multipurpose tray', Output: '150-sheet bin' },
      Connectivity: { Ports: 'Hi-Speed USB 2.0, Gigabit Ethernet' },
      Consumables: { Toner: 'HP 59A / 59X black toner cartridges' },
      Warranty: { Coverage: '1 Year HP warranty' }
    }
  },
  'OFF-A4-REAM': {
    description: `Everyday 80gsm A4 copy paper, 500 sheets per ream. Bright white and smooth for clean prints, and suitable for laser printers, inkjet printers and photocopiers.

Order in bulk (boxes of 5 reams) for offices — ask us about volume pricing.`,
    specs: {
      Paper: { Size: 'A4 (210 × 297 mm)', Weight: '80 gsm', Sheets: '500 per ream' },
      Compatibility: { Devices: 'Laser, inkjet, copiers' }
    }
  },
  'CAN-INK-SET': {
    description: `A black and tri-colour ink cartridge set for Canon inkjet printers. Delivers sharp black text and vivid colour for documents and photos.

Cartridge numbers differ between Canon models — send us your printer model and we'll confirm the matching cartridges before you order.`,
    specs: {
      Set: { Contents: '1 × black + 1 × tri-colour cartridge' },
      Compatibility: { Printers: 'Canon PIXMA inkjet models — confirm your model with our team' }
    }
  }
};
