/* eslint-disable no-console */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/** Approximate real coordinates for Chennai-region areas. */
export const AREAS: Record<string, { city: string; lat: number; lng: number }> = {
  Velachery: { city: 'Chennai', lat: 12.9815, lng: 80.218 },
  'T. Nagar': { city: 'Chennai', lat: 13.0418, lng: 80.2341 },
  Adyar: { city: 'Chennai', lat: 13.0012, lng: 80.2565 },
  Guindy: { city: 'Chennai', lat: 13.0067, lng: 80.2206 },
  Porur: { city: 'Chennai', lat: 13.0382, lng: 80.1565 },
  Pallikaranai: { city: 'Chennai', lat: 12.9352, lng: 80.2137 },
  'Anna Nagar': { city: 'Chennai', lat: 13.085, lng: 80.2101 },
  Tambaram: { city: 'Tambaram', lat: 12.9249, lng: 80.1 },
  Mudichur: { city: 'Tambaram', lat: 12.9166, lng: 80.0733 },
  Chromepet: { city: 'Tambaram', lat: 12.9516, lng: 80.1462 },
  Kattankulathur: { city: 'Chengalpattu', lat: 12.8231, lng: 80.0442 },
  Potheri: { city: 'Chengalpattu', lat: 12.8231, lng: 80.0381 },
};

type Seq = 'OPEN' | 'ACCEPTED' | 'IN_PROGRESS' | 'FULFILLED' | 'CANCELLED';

interface SeedRequest {
  title: string;
  category: string;
  description: string;
  quantity: number;
  peopleAffected: number;
  priority: string;
  status: Seq;
  area: string;
  addressLine: string;
  hoursAgo: number;
  requester: number; // index into requesters
  volunteer?: number; // index into approved volunteers
  fulfilledByRequester?: boolean;
  releasedFirstBy?: number; // volunteer who accepted then released before current volunteer
  cancelNote?: string;
}

const REQUESTS: SeedRequest[] = [
  { title: 'Drinking water for flooded street', category: 'WATER', description: 'Our street has been waterlogged for 2 days and the corporation supply is contaminated. Need 20L drinking water cans for 8 families.', quantity: 16, peopleAffected: 32, priority: 'CRITICAL', status: 'OPEN', area: 'Velachery', addressLine: '4th Cross St, Vijaya Nagar', hoursAgo: 3, requester: 0 },
  { title: 'Elderly couple stranded, need evacuation', category: 'TRANSPORT', description: 'Elderly couple (78 and 74) on ground floor, water at knee level and rising. Need a vehicle that can handle water to move them to a relative\'s house in Guindy.', quantity: 1, peopleAffected: 2, priority: 'CRITICAL', status: 'OPEN', area: 'Mudichur', addressLine: 'Lakshmi Nagar 2nd St', hoursAgo: 1.5, requester: 1 },
  { title: 'Food packets for 40 people at community hall', category: 'FOOD', description: 'Around 40 people moved into the community hall last night. We have rice but no way to cook. Need ready-to-eat food packets for dinner.', quantity: 40, peopleAffected: 40, priority: 'CRITICAL', status: 'ACCEPTED', area: 'Pallikaranai', addressLine: 'Kamakoti Nagar Community Hall', hoursAgo: 5, requester: 2, volunteer: 0 },
  { title: 'Temporary shelter for family of 5', category: 'SHELTER', description: 'Our hut roof collapsed in the cyclone winds. Family of 5 including a 2 year old. Need a dry place to stay for 2-3 nights.', quantity: 1, peopleAffected: 5, priority: 'HIGH', status: 'OPEN', area: 'Tambaram', addressLine: 'Near Tambaram West bus stand', hoursAgo: 7, requester: 3 },
  { title: 'Candles and matchboxes - power out 30 hrs', category: 'OTHER_ESSENTIALS', description: 'No power in our block for more than a day. Need candles, matchboxes and if possible a couple of torch lights with batteries.', quantity: 30, peopleAffected: 20, priority: 'MEDIUM', status: 'OPEN', area: 'Adyar', addressLine: 'Gandhi Nagar 3rd Main Rd', hoursAgo: 10, requester: 4 },
  { title: 'Milk powder and biscuits for children', category: 'FOOD', description: 'Six young kids in our apartment block. Shops are closed. Need milk powder and biscuit packets.', quantity: 12, peopleAffected: 6, priority: 'HIGH', status: 'IN_PROGRESS', area: 'Velachery', addressLine: 'Taramani Link Rd, Sri Sai Apartments', hoursAgo: 9, requester: 0, volunteer: 1 },
  { title: 'Water cans for hostel students', category: 'WATER', description: 'Private hostel near the university has had no water for a day. About 60 students. Need 20L cans.', quantity: 25, peopleAffected: 60, priority: 'HIGH', status: 'OPEN', area: 'Kattankulathur', addressLine: 'Potheri Main Rd, Sunrise Hostel', hoursAgo: 12, requester: 1 },
  { title: 'Ride to railway station for stranded workers', category: 'TRANSPORT', description: 'Four construction workers need to reach Tambaram station to catch the evening train home. Buses are not running on this route.', quantity: 1, peopleAffected: 4, priority: 'MEDIUM', status: 'FULFILLED', area: 'Porur', addressLine: 'Porur Junction, near flyover', hoursAgo: 30, requester: 2, volunteer: 2 },
  { title: 'Dry clothes and bedsheets', category: 'OTHER_ESSENTIALS', description: 'Water entered our house and everything is soaked. Need dry clothes (adults) and bedsheets for 4 people.', quantity: 8, peopleAffected: 4, priority: 'MEDIUM', status: 'FULFILLED', area: 'Guindy', addressLine: 'Race Course Rd, Line 3', hoursAgo: 40, requester: 3, volunteer: 0, fulfilledByRequester: true },
  { title: 'Cooked lunch for relief camp', category: 'FOOD', description: 'Relief camp at the school needs lunch for about 120 people. Volunteers are cooking but need 60 more meal packets.', quantity: 60, peopleAffected: 120, priority: 'CRITICAL', status: 'FULFILLED', area: 'Mudichur', addressLine: 'Panchayat Union Primary School', hoursAgo: 44, requester: 4, volunteer: 1 },
  { title: 'Shelter needed for night - house flooded', category: 'SHELTER', description: 'Ground floor house flooded up to 3 feet. Need shelter for tonight for 3 adults.', quantity: 1, peopleAffected: 3, priority: 'HIGH', status: 'ACCEPTED', area: 'Velachery', addressLine: 'Ram Nagar South Extn', hoursAgo: 4, requester: 0, volunteer: 2, releasedFirstBy: 1 },
  { title: 'Wheelchair user needs transport to relative', category: 'TRANSPORT', description: 'My father uses a wheelchair and our area is cut off. Need a vehicle with space for a folded wheelchair to reach Anna Nagar.', quantity: 1, peopleAffected: 2, priority: 'HIGH', status: 'OPEN', area: 'Chromepet', addressLine: 'Radha Nagar Main Rd', hoursAgo: 6, requester: 1 },
  { title: 'Drinking water for street vendors', category: 'WATER', description: 'Vendors near the market have been working to clear debris. Need drinking water bottles.', quantity: 50, peopleAffected: 25, priority: 'LOW', status: 'OPEN', area: 'T. Nagar', addressLine: 'Ranganathan St, near market entrance', hoursAgo: 20, requester: 2 },
  { title: 'Mosquito coils and repellent', category: 'OTHER_ESSENTIALS', description: 'Stagnant water all around. Families with small kids need mosquito coils / repellent.', quantity: 20, peopleAffected: 15, priority: 'LOW', status: 'OPEN', area: 'Pallikaranai', addressLine: 'Balaji Nagar 1st St', hoursAgo: 26, requester: 3 },
  { title: 'Breakfast for 25 at temple shelter', category: 'FOOD', description: 'About 25 people stayed overnight at the temple mandapam. Need breakfast (idli / upma packets are fine).', quantity: 25, peopleAffected: 25, priority: 'HIGH', status: 'FULFILLED', area: 'Adyar', addressLine: 'Kasturba Nagar temple mandapam', hoursAgo: 22, requester: 4, volunteer: 0 },
  { title: 'Tarpaulin sheets for damaged roofs', category: 'SHELTER', description: 'Three houses in our lane lost their asbestos roofs. Tarpaulin sheets would help us get through the rain.', quantity: 6, peopleAffected: 14, priority: 'MEDIUM', status: 'IN_PROGRESS', area: 'Tambaram', addressLine: 'Kishkinta Rd, Irumbuliyur', hoursAgo: 15, requester: 3, volunteer: 0 },
  { title: 'Water tanker for apartment complex', category: 'WATER', description: 'Sump contaminated by flood water. 48-flat complex needs a clean water tanker.', quantity: 1, peopleAffected: 150, priority: 'HIGH', status: 'CANCELLED', area: 'Anna Nagar', addressLine: '2nd Avenue, Block Q', hoursAgo: 36, requester: 2, cancelNote: 'Metro water tanker arrived, no longer needed.' },
  { title: 'Food for dialysis patient\'s family', category: 'FOOD', description: 'Family is at the hospital with a patient and cannot cook. Need simple meals for 3 people for 2 days.', quantity: 12, peopleAffected: 3, priority: 'MEDIUM', status: 'OPEN', area: 'Guindy', addressLine: 'Near Kathipara Junction', hoursAgo: 14, requester: 0 },
  { title: 'Ride for students to exam centre', category: 'TRANSPORT', description: 'Three students need to reach their exam centre in Guindy by 9 AM tomorrow. No buses from our area.', quantity: 1, peopleAffected: 3, priority: 'MEDIUM', status: 'ACCEPTED', area: 'Potheri', addressLine: 'Potheri station road', hoursAgo: 11, requester: 1, volunteer: 1 },
  { title: 'Sanitary pads and soap', category: 'OTHER_ESSENTIALS', description: 'Women at the relief camp need sanitary pads, bathing soap and toothpaste.', quantity: 40, peopleAffected: 30, priority: 'HIGH', status: 'OPEN', area: 'Mudichur', addressLine: 'Panchayat Union Primary School', hoursAgo: 8, requester: 4 },
  { title: 'Space to stay for 2 nurses on duty', category: 'SHELTER', description: 'Two nurses working double shifts at a nearby clinic cannot get home. Need a safe place to rest nearby for 2 nights.', quantity: 1, peopleAffected: 2, priority: 'LOW', status: 'FULFILLED', area: 'Porur', addressLine: 'Arcot Rd, near Porur signal', hoursAgo: 47, requester: 2, volunteer: 2 },
  { title: 'Rice and dal for 10 families', category: 'FOOD', description: 'Daily wage families have had no work for 4 days. Need rice and dal (5 kg each) for 10 families.', quantity: 10, peopleAffected: 42, priority: 'MEDIUM', status: 'OPEN', area: 'Kattankulathur', addressLine: 'SRM Nagar, behind bus depot', hoursAgo: 18, requester: 3 },
  { title: 'Need boat - family on terrace', category: 'TRANSPORT', description: 'Duplicate request - posted twice by mistake.', quantity: 1, peopleAffected: 6, priority: 'CRITICAL', status: 'CANCELLED', area: 'Velachery', addressLine: 'Vijaya Nagar Bus Stop', hoursAgo: 2.5, requester: 0, cancelNote: 'Duplicate of another request.' },
  { title: 'Free iPhones for flood victims', category: 'OTHER_ESSENTIALS', description: 'Send your bank details to get free phones and cash relief. Call now!!', quantity: 100, peopleAffected: 100, priority: 'LOW', status: 'OPEN', area: 'T. Nagar', addressLine: 'Pondy Bazaar', hoursAgo: 5, requester: 4 },
  { title: 'Bottled water for bus stranded passengers', category: 'WATER', description: 'An interstate bus has been stuck on the highway for 6 hours due to waterlogging. About 35 passengers need water.', quantity: 70, peopleAffected: 35, priority: 'CRITICAL', status: 'IN_PROGRESS', area: 'Guindy', addressLine: 'GST Rd near Guindy Industrial Estate', hoursAgo: 2, requester: 1, volunteer: 2 },
];

const HOUR = 60 * 60 * 1000;

function jitter(value: number, seed: number) {
  // Deterministic small offset (~up to 700m) so pins in the same area don't overlap.
  return Number((value + (((seed * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.012).toFixed(6));
}

export async function seedDatabase(prisma: PrismaClient, opts: { quiet?: boolean } = {}) {
  const log = (...args: unknown[]) => !opts.quiet && console.log(...args);

  await prisma.flag.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.request.deleteMany();
  await prisma.user.deleteMany();

  const adminHash = await bcrypt.hash('Admin@123', 10);
  const demoHash = await bcrypt.hash('Demo@123', 10);
  const now = Date.now();

  const mkUser = (u: {
    name: string; email: string; phone: string; role: string; area: string;
    verificationStatus?: string; verificationNote?: string; idProofText?: string;
    skills?: string; hasVehicle?: boolean; daysAgo?: number; hash?: string;
  }) => {
    const loc = AREAS[u.area];
    return prisma.user.create({
      data: {
        name: u.name, email: u.email, phone: u.phone, role: u.role,
        passwordHash: u.hash ?? demoHash,
        city: loc.city, area: u.area, lat: loc.lat, lng: loc.lng,
        verificationStatus: u.verificationStatus ?? 'NOT_REQUIRED',
        verificationNote: u.verificationNote, idProofText: u.idProofText,
        skills: u.skills, hasVehicle: u.hasVehicle ?? false,
        verifiedAt: u.verificationStatus === 'APPROVED' || u.verificationStatus === 'REJECTED'
          ? new Date(now - (u.daysAgo ?? 3) * 24 * HOUR + 6 * HOUR) : null,
        createdAt: new Date(now - (u.daysAgo ?? 3) * 24 * HOUR),
      },
    });
  };

  const admin = await mkUser({ name: 'Relay Admin', email: 'admin@relay.demo', phone: '+91 90000 00001', role: 'ADMIN', area: 'Guindy', hash: adminHash, daysAgo: 30 });

  const requesters = [
    await mkUser({ name: 'Lakshmi Narayanan', email: 'requester@relay.demo', phone: '+91 90000 00011', role: 'REQUESTER', area: 'Velachery' }),
    await mkUser({ name: 'Mohammed Irfan', email: 'irfan@relay.demo', phone: '+91 90000 00012', role: 'REQUESTER', area: 'Mudichur' }),
    await mkUser({ name: 'Kavitha Rajendran', email: 'kavitha@relay.demo', phone: '+91 90000 00013', role: 'REQUESTER', area: 'Pallikaranai' }),
    await mkUser({ name: 'Suresh Babu', email: 'suresh@relay.demo', phone: '+91 90000 00014', role: 'REQUESTER', area: 'Tambaram' }),
    await mkUser({ name: 'Anitha Joseph', email: 'anitha@relay.demo', phone: '+91 90000 00015', role: 'REQUESTER', area: 'Adyar' }),
  ];

  const approved = [
    await mkUser({ name: 'Karthik Subramanian', email: 'volunteer@relay.demo', phone: '+91 90000 00021', role: 'VOLUNTEER', area: 'Velachery', verificationStatus: 'APPROVED', verificationNote: 'NGO ID verified by phone.', idProofText: 'Bhumi NGO volunteer ID #BH-2231', skills: 'Two-wheeler, can carry supplies', hasVehicle: true, daysAgo: 10 }),
    await mkUser({ name: 'Divya Ramesh', email: 'divya@relay.demo', phone: '+91 90000 00022', role: 'VOLUNTEER', area: 'Adyar', verificationStatus: 'APPROVED', verificationNote: 'College ID checked.', idProofText: 'Anna University student ID 2021CS114', skills: 'Cooking, packing food', hasVehicle: false, daysAgo: 8 }),
    await mkUser({ name: 'Arjun Prakash', email: 'arjun@relay.demo', phone: '+91 90000 00023', role: 'VOLUNTEER', area: 'Porur', verificationStatus: 'APPROVED', verificationNote: 'Known to the Porur RWA.', idProofText: 'Porur Residents Welfare Assn. member', skills: 'Owns an SUV, can drive in shallow water', hasVehicle: true, daysAgo: 6 }),
  ];

  await mkUser({ name: 'Priya Venkatesh', email: 'pending@relay.demo', phone: '+91 90000 00031', role: 'VOLUNTEER', area: 'Velachery', verificationStatus: 'PENDING', idProofText: 'SRM University student ID RA2111003', skills: 'Car available, first-aid trained', hasVehicle: true, daysAgo: 1 });
  await mkUser({ name: 'Rahul Menon', email: 'rahul@relay.demo', phone: '+91 90000 00032', role: 'VOLUNTEER', area: 'Kattankulathur', verificationStatus: 'PENDING', idProofText: 'NSS volunteer, SRM KTR', skills: 'Can help load and distribute supplies', daysAgo: 0.5 });
  await mkUser({ name: 'Vignesh K', email: 'vignesh@relay.demo', phone: '+91 90000 00033', role: 'VOLUNTEER', area: 'T. Nagar', verificationStatus: 'REJECTED', verificationNote: 'ID proof could not be verified. Please re-register with an NGO or college ID.', idProofText: 'none', daysAgo: 4 });

  let seedIdx = 1;
  for (const r of REQUESTS) {
    const loc = AREAS[r.area];
    const createdAt = new Date(now - r.hoursAgo * HOUR);
    const requester = requesters[r.requester];
    const volunteer = r.volunteer !== undefined ? approved[r.volunteer] : undefined;

    // Build the chain of status changes that leads to the final status.
    type Step = { from: string | null; to: string; by: string; note?: string };
    const steps: Step[] = [{ from: null, to: 'OPEN', by: requester.id }];
    if (r.releasedFirstBy !== undefined) {
      const first = approved[r.releasedFirstBy];
      steps.push({ from: 'OPEN', to: 'ACCEPTED', by: first.id });
      steps.push({ from: 'ACCEPTED', to: 'OPEN', by: first.id, note: 'Vehicle broke down, releasing so someone else can help.' });
    }
    if (r.status === 'CANCELLED') {
      steps.push({ from: 'OPEN', to: 'CANCELLED', by: requester.id, note: r.cancelNote });
    }
    if (['ACCEPTED', 'IN_PROGRESS', 'FULFILLED'].includes(r.status) && volunteer) {
      steps.push({ from: 'OPEN', to: 'ACCEPTED', by: volunteer.id, note: 'On it!' });
    }
    if (['IN_PROGRESS', 'FULFILLED'].includes(r.status) && volunteer) {
      steps.push({ from: 'ACCEPTED', to: 'IN_PROGRESS', by: volunteer.id, note: 'Collected supplies, heading there now.' });
    }
    if (r.status === 'FULFILLED' && volunteer) {
      steps.push({
        from: 'IN_PROGRESS', to: 'FULFILLED',
        by: r.fulfilledByRequester ? requester.id : volunteer.id,
        note: r.fulfilledByRequester ? 'Received everything, thank you so much!' : 'Delivered and handed over.',
      });
    }

    const span = r.hoursAgo * HOUR * 0.8;
    const stepTime = (i: number) => new Date(createdAt.getTime() + (i === 0 ? 0 : (span * i) / steps.length));
    const last = stepTime(steps.length - 1);

    const created = await prisma.request.create({
      data: {
        title: r.title, category: r.category, description: r.description,
        quantity: r.quantity, peopleAffected: r.peopleAffected, priority: r.priority,
        status: r.status, city: loc.city, area: r.area, addressLine: r.addressLine,
        lat: jitter(loc.lat, seedIdx++), lng: jitter(loc.lng, seedIdx++),
        contactPhone: requester.phone, requesterId: requester.id,
        volunteerId: r.status === 'CANCELLED' || r.status === 'OPEN' ? null : volunteer?.id ?? null,
        createdAt, updatedAt: last,
        fulfilledAt: r.status === 'FULFILLED' ? last : null,
        history: {
          create: steps.map((s, i) => ({
            fromStatus: s.from, toStatus: s.to, changedById: s.by, note: s.note, createdAt: stepTime(i),
          })),
        },
      },
    });

    if (r.title.startsWith('Free iPhones')) {
      await prisma.flag.createMany({
        data: [
          { requestId: created.id, reportedById: approved[0].id, reason: 'Looks like a scam - asks for bank details.' },
          { requestId: created.id, reportedById: requesters[0].id, reason: 'Not a genuine need, spam.' },
        ],
      });
    }
  }

  const counts = {
    users: await prisma.user.count(),
    requests: await prisma.request.count(),
    history: await prisma.statusHistory.count(),
    flags: await prisma.flag.count(),
  };
  log('[seed] done', counts);
  log('[seed] admin:', admin.email, '/ Admin@123');
  log('[seed] requester@relay.demo, volunteer@relay.demo, pending@relay.demo / Demo@123');
  return counts;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDatabase(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
