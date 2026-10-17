import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Types } from 'mongoose'

// One document per player: profile, stats, garage and recent activity are embedded because they are
// always read together (the snapshot). Market, swaps, races and sales are shared between players and
// live in their own collections.

const ownedCar = new Schema({
  carId: { type: String, required: true },
  serial: { type: Number, required: true },
  level: { type: Number, default: 0, min: 0, max: 5 },
  acquiredAt: { type: Date, default: Date.now },
  showcase: { type: Boolean, default: false },
}, { _id: false })

const activity = new Schema({
  at: { type: Date, default: Date.now },
  verb: { type: String, required: true },
  what: { type: String, required: true },
}, { _id: false })

const friend = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  accepted: { type: Boolean, default: false },
}, { _id: false })

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 24 },
  region: { type: String, default: 'France' },
  city: { type: String, default: '' },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  credits: { type: Number, default: 5000, min: 0 },
  settings: { type: new Schema({
    sound: { type: Boolean, default: true },
    reduceMotion: { type: Boolean, default: false },
    notifications: { type: Boolean, default: true },
    showGarageValue: { type: Boolean, default: true },
  }, { _id: false }), default: () => ({}) },
  stats: { type: new Schema({
    racesRun: { type: Number, default: 0 },
    racesWon: { type: Number, default: 0 },
    seasonPoints: { type: Number, default: 0 },
    packsOpened: { type: Number, default: 0 },
    legendaryPulls: { type: Number, default: 0 },
    pity: { type: Number, default: 0 },
    trades: { type: Number, default: 0 },
    tradeNet: { type: Number, default: 0 },
    bestLap: { type: String, default: '—' },
    streak: { type: Number, default: 1 },
    bestStreak: { type: Number, default: 1 },
  }, { _id: false }), default: () => ({}) },
  freePackAt: { type: Date, default: Date.now },
  onboarded: { type: Boolean, default: false },
  garage: { type: [ownedCar], default: [] },
  activity: { type: [activity], default: [] },
  friends: { type: [friend], default: [] },
}, { timestamps: true })

export const User = mongoose.model('User', userSchema)
export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>

const listingSchema = new Schema({
  // null: a house seller that keeps the market stocked
  seller: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  sellerName: { type: String, required: true },
  carId: { type: String, required: true },
  level: { type: Number, default: 0 },
  // serial held in escrow while a player's car is listed
  serial: { type: Number, default: null },
  price: { type: Number, required: true, min: 100 },
  endsAt: { type: Date, required: true },
  status: { type: String, enum: ['active', 'sold', 'cancelled', 'expired'], default: 'active' },
}, { timestamps: true })
listingSchema.index({ status: 1, endsAt: 1 })
export const Listing = mongoose.model('Listing', listingSchema)

const saleSchema = new Schema({
  carId: { type: String, required: true },
  price: { type: Number, required: true },
  soldAt: { type: Date, default: Date.now },
})
saleSchema.index({ carId: 1, soldAt: -1 })
export const Sale = mongoose.model('Sale', saleSchema)

const swapSchema = new Schema({
  proposer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // null when proposed to a house seller (never accepted)
  recipient: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  recipientName: { type: String, required: true },
  proposerCar: { type: String, required: true },
  recipientCar: { type: String, required: true },
  credits: { type: Number, default: 0, min: 0 },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['open', 'accepted', 'declined'], default: 'open' },
})
export const SwapOffer = mongoose.model('SwapOffer', swapSchema)

const raceSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: String, required: true },
  carId: { type: String, required: true },
  level: { type: Number, required: true },
  finishedAt: { type: Date, default: null },
  result: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true })
export const Race = mongoose.model('Race', raceSchema)

const calendarSchema = new Schema({
  startsAt: { type: Date, required: true },
  name: { type: String, required: true },
  rule: { type: String, required: true },
  prize: { type: String, required: true },
  eventId: { type: String, required: true },
  fee: { type: Number, required: true },
  featured: { type: Boolean, default: false },
})
export const CalendarEvent = mongoose.model('CalendarEvent', calendarSchema)

const seasonSchema = new Schema({
  number: { type: Number, required: true, unique: true },
  endsAt: { type: Date, required: true },
})
export const Season = mongoose.model('Season', seasonSchema)

export type Id = Types.ObjectId
