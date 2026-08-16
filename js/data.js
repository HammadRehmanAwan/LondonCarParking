/**
 * Indicative Controlled Parking Zone (CPZ / permit zone) data for London.
 *
 * Boundaries are simplified, approximate outlines of well-known controlled
 * areas and hours are the typical published controlled hours for each area.
 * Boroughs change zones and hours regularly — every popup links to the
 * borough's parking pages so drivers can confirm before travelling.
 *
 * hours: list of rules; days uses JS getDay() numbering (0 = Sunday).
 * Within a rule the zone is CONTROLLED between start and end (24h "HH:MM").
 */
const CPZ_ZONES = [
  {
    id: "westminster-west-end",
    borough: "Westminster",
    name: "West End (Soho / Covent Garden)",
    hours: [
      { days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "23:59" },
      { days: [0], start: "12:00", end: "18:00" },
    ],
    hoursText: "Mon–Sat 8:30am–midnight, Sun 12pm–6pm",
    url: "https://www.westminster.gov.uk/parking",
    polygon: [
      [51.5170, -0.1450], [51.5170, -0.1200], [51.5085, -0.1200],
      [51.5085, -0.1330], [51.5115, -0.1450],
    ],
  },
  {
    id: "westminster-core",
    borough: "Westminster",
    name: "Mayfair / Marylebone",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "18:30" }],
    hoursText: "Mon–Sat 8:30am–6:30pm",
    url: "https://www.westminster.gov.uk/parking",
    polygon: [
      [51.5230, -0.1620], [51.5230, -0.1400], [51.5100, -0.1400],
      [51.5060, -0.1520], [51.5120, -0.1620],
    ],
  },
  {
    id: "camden-town",
    borough: "Camden",
    name: "Camden Town (Zone CA-D)",
    hours: [{ days: [0, 1, 2, 3, 4, 5, 6], start: "08:30", end: "20:30" }],
    hoursText: "Mon–Sun 8:30am–8:30pm",
    url: "https://www.camden.gov.uk/parking",
    polygon: [
      [51.5460, -0.1520], [51.5460, -0.1330], [51.5330, -0.1330],
      [51.5330, -0.1520],
    ],
  },
  {
    id: "camden-bloomsbury",
    borough: "Camden",
    name: "Bloomsbury / King's Cross (Zone CA-A)",
    hours: [{ days: [1, 2, 3, 4, 5], start: "08:30", end: "18:30" }],
    hoursText: "Mon–Fri 8:30am–6:30pm",
    url: "https://www.camden.gov.uk/parking",
    polygon: [
      [51.5320, -0.1330], [51.5320, -0.1130], [51.5180, -0.1130],
      [51.5180, -0.1330],
    ],
  },
  {
    id: "islington-angel",
    borough: "Islington",
    name: "Angel / Upper Street (Zone A)",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "18:30" }],
    hoursText: "Mon–Sat 8:30am–6:30pm",
    url: "https://www.islington.gov.uk/parking",
    polygon: [
      [51.5420, -0.1130], [51.5420, -0.0950], [51.5290, -0.0950],
      [51.5290, -0.1130],
    ],
  },
  {
    id: "hackney-shoreditch",
    borough: "Hackney",
    name: "Shoreditch / Hoxton",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:00", end: "20:00" }],
    hoursText: "Mon–Sat 8am–8pm",
    url: "https://hackney.gov.uk/parking",
    polygon: [
      [51.5330, -0.0920], [51.5330, -0.0700], [51.5210, -0.0700],
      [51.5210, -0.0920],
    ],
  },
  {
    id: "city-of-london",
    borough: "City of London",
    name: "Square Mile",
    hours: [{ days: [1, 2, 3, 4, 5], start: "08:00", end: "18:30" }],
    hoursText: "Mon–Fri 8am–6:30pm",
    url: "https://www.cityoflondon.gov.uk/services/streets/parking",
    polygon: [
      [51.5200, -0.1120], [51.5210, -0.0800], [51.5100, -0.0770],
      [51.5080, -0.1050],
    ],
  },
  {
    id: "tower-hamlets-whitechapel",
    borough: "Tower Hamlets",
    name: "Whitechapel / Aldgate East",
    hours: [{ days: [1, 2, 3, 4, 5], start: "08:30", end: "17:30" }],
    hoursText: "Mon–Fri 8:30am–5:30pm",
    url: "https://www.towerhamlets.gov.uk/lgnl/transport_and_streets/parking/parking.aspx",
    polygon: [
      [51.5210, -0.0750], [51.5210, -0.0500], [51.5100, -0.0500],
      [51.5100, -0.0750],
    ],
  },
  {
    id: "southwark-borough",
    borough: "Southwark",
    name: "Borough / Bankside",
    hours: [{ days: [1, 2, 3, 4, 5], start: "08:30", end: "18:30" }],
    hoursText: "Mon–Fri 8:30am–6:30pm",
    url: "https://www.southwark.gov.uk/parking",
    polygon: [
      [51.5080, -0.1050], [51.5080, -0.0850], [51.4950, -0.0850],
      [51.4950, -0.1050],
    ],
  },
  {
    id: "lambeth-waterloo",
    borough: "Lambeth",
    name: "Waterloo / North Lambeth",
    hours: [{ days: [1, 2, 3, 4, 5], start: "08:30", end: "18:30" }],
    hoursText: "Mon–Fri 8:30am–6:30pm",
    url: "https://www.lambeth.gov.uk/parking-transport-and-streets",
    polygon: [
      [51.5050, -0.1250], [51.5050, -0.1050], [51.4900, -0.1050],
      [51.4900, -0.1250],
    ],
  },
  {
    id: "rbkc",
    borough: "Kensington & Chelsea",
    name: "Kensington & Chelsea (borough-wide)",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "18:30" }],
    hoursText: "Mon–Sat 8:30am–6:30pm",
    url: "https://www.rbkc.gov.uk/parking",
    polygon: [
      [51.5120, -0.2100], [51.5120, -0.1550], [51.4820, -0.1650],
      [51.4790, -0.2000],
    ],
  },
  {
    id: "lbhf-hammersmith",
    borough: "Hammersmith & Fulham",
    name: "Hammersmith town centre",
    hours: [{ days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }],
    hoursText: "Mon–Fri 9am–5pm",
    url: "https://www.lbhf.gov.uk/parking",
    polygon: [
      [51.5000, -0.2400], [51.5000, -0.2100], [51.4830, -0.2100],
      [51.4830, -0.2400],
    ],
  },
  {
    id: "wandsworth-clapham-junction",
    borough: "Wandsworth",
    name: "Clapham Junction / Battersea",
    hours: [{ days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }],
    hoursText: "Mon–Fri 9am–5pm",
    url: "https://www.wandsworth.gov.uk/parking-and-travel/",
    polygon: [
      [51.4700, -0.1800], [51.4700, -0.1580], [51.4550, -0.1580],
      [51.4550, -0.1800],
    ],
  },
  {
    id: "greenwich-west",
    borough: "Greenwich",
    name: "West Greenwich",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "18:30" }],
    hoursText: "Mon–Sat 9am–6:30pm",
    url: "https://www.royalgreenwich.gov.uk/parking",
    polygon: [
      [51.4850, -0.0200], [51.4850, 0.0000], [51.4700, 0.0000],
      [51.4700, -0.0200],
    ],
  },
  {
    id: "haringey-harringay",
    borough: "Haringey",
    name: "Harringay / Green Lanes",
    hours: [{ days: [1, 2, 3, 4, 5], start: "08:00", end: "18:30" }],
    hoursText: "Mon–Fri 8am–6:30pm",
    url: "https://www.haringey.gov.uk/parking-roads-and-travel/parking",
    polygon: [
      [51.5850, -0.1110], [51.5850, -0.0900], [51.5700, -0.0900],
      [51.5700, -0.1110],
    ],
  },
  {
    id: "newham-borough-wide",
    borough: "Newham",
    name: "Newham residents' parking (borough-wide)",
    hours: [{ days: [0, 1, 2, 3, 4, 5, 6], start: "08:00", end: "21:00" }],
    hoursText: "Mon–Sun 8am–9pm",
    url: "https://www.newham.gov.uk/parking-permits-potholes",
    polygon: [
      [51.5450, 0.0000], [51.5450, 0.0600], [51.5100, 0.0600],
      [51.5100, 0.0000],
    ],
  },
  {
    id: "brent-wembley",
    borough: "Brent",
    name: "Wembley Park (event day controls)",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:00", end: "18:30" }],
    hoursText: "Mon–Sat 8am–6:30pm (extended on Wembley event days)",
    url: "https://www.brent.gov.uk/parking-roads-and-travel",
    polygon: [
      [51.5650, -0.2900], [51.5650, -0.2700], [51.5500, -0.2700],
      [51.5500, -0.2900],
    ],
  },
  {
    id: "ealing-centre",
    borough: "Ealing",
    name: "Ealing town centre",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "17:00" }],
    hoursText: "Mon–Sat 9am–5pm",
    url: "https://www.ealing.gov.uk/info/201104/parking",
    polygon: [
      [51.5200, -0.3150], [51.5200, -0.2950], [51.5050, -0.2950],
      [51.5050, -0.3150],
    ],
  },
  {
    id: "croydon-centre",
    borough: "Croydon",
    name: "Croydon town centre",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "18:30" }],
    hoursText: "Mon–Sat 8:30am–6:30pm",
    url: "https://www.croydon.gov.uk/parking",
    polygon: [
      [51.3800, -0.1100], [51.3800, -0.0900], [51.3650, -0.0900],
      [51.3650, -0.1100],
    ],
  },
  {
    id: "richmond-centre",
    borough: "Richmond upon Thames",
    name: "Richmond town centre",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "18:30" }],
    hoursText: "Mon–Sat 8:30am–6:30pm",
    url: "https://www.richmond.gov.uk/parking",
    polygon: [
      [51.4650, -0.3100], [51.4650, -0.2900], [51.4550, -0.2900],
      [51.4550, -0.3100],
    ],
  },
  {
    id: "waltham-forest-walthamstow",
    borough: "Waltham Forest",
    name: "Walthamstow town centre",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:00", end: "18:30" }],
    hoursText: "Mon–Sat 8am–6:30pm",
    url: "https://www.walthamforest.gov.uk/parking-roads-and-travel",
    polygon: [
      [51.5900, -0.0350], [51.5900, -0.0150], [51.5780, -0.0150],
      [51.5780, -0.0350],
    ],
  },
  {
    id: "redbridge-ilford",
    borough: "Redbridge",
    name: "Ilford town centre",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:00", end: "18:30" }],
    hoursText: "Mon–Sat 8am–6:30pm",
    url: "https://www.redbridge.gov.uk/parking/",
    polygon: [
      [51.5650, 0.0620], [51.5650, 0.0830], [51.5550, 0.0830],
      [51.5550, 0.0620],
    ],
  },
  {
    id: "barking-centre",
    borough: "Barking & Dagenham",
    name: "Barking town centre",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:00", end: "18:30" }],
    hoursText: "Mon–Sat 8am–6:30pm",
    url: "https://www.lbbd.gov.uk/parking",
    polygon: [
      [51.5430, 0.0730], [51.5430, 0.0880], [51.5330, 0.0880],
      [51.5330, 0.0730],
    ],
  },
  {
    id: "hounslow-centre",
    borough: "Hounslow",
    name: "Hounslow town centre",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "17:00" }],
    hoursText: "Mon–Sat 9am–5pm",
    url: "https://www.hounslow.gov.uk/parking",
    polygon: [
      [51.4740, -0.3750], [51.4740, -0.3550], [51.4640, -0.3550],
      [51.4640, -0.3750],
    ],
  },
  {
    id: "kingston-centre",
    borough: "Kingston upon Thames",
    name: "Kingston town centre",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "18:30" }],
    hoursText: "Mon–Sat 8:30am–6:30pm",
    url: "https://www.kingston.gov.uk/parking",
    polygon: [
      [51.4160, -0.3100], [51.4160, -0.2950], [51.4050, -0.2950],
      [51.4050, -0.3100],
    ],
  },
  {
    id: "harrow-centre",
    borough: "Harrow",
    name: "Harrow town centre",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "18:30" }],
    hoursText: "Mon–Sat 8:30am–6:30pm",
    url: "https://www.harrow.gov.uk/parking",
    polygon: [
      [51.5850, -0.3450], [51.5850, -0.3300], [51.5750, -0.3300],
      [51.5750, -0.3450],
    ],
  },
  {
    id: "enfield-town",
    borough: "Enfield",
    name: "Enfield Town",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:00", end: "18:30" }],
    hoursText: "Mon–Sat 8am–6:30pm",
    url: "https://www.enfield.gov.uk/services/parking",
    polygon: [
      [51.6570, -0.0900], [51.6570, -0.0700], [51.6470, -0.0700],
      [51.6470, -0.0900],
    ],
  },
  {
    id: "bromley-centre",
    borough: "Bromley",
    name: "Bromley town centre",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:00", end: "18:30" }],
    hoursText: "Mon–Sat 8am–6:30pm",
    url: "https://www.bromley.gov.uk/parking",
    polygon: [
      [51.4100, 0.0100], [51.4100, 0.0250], [51.3980, 0.0250],
      [51.3980, 0.0100],
    ],
  },
  {
    id: "lewisham-centre",
    borough: "Lewisham",
    name: "Lewisham town centre",
    hours: [{ days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "18:30" }],
    hoursText: "Mon–Sat 8:30am–6:30pm",
    url: "https://lewisham.gov.uk/myservices/parking",
    polygon: [
      [51.4700, -0.0250], [51.4700, -0.0050], [51.4550, -0.0050],
      [51.4550, -0.0250],
    ],
  },
];
