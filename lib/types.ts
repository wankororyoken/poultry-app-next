export type Worker = {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export type Room = {
  id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export type EggRecord = {
  id: string
  record_date: string
  period: '午前' | '午後'
  room_id: string
  count: number
  worker_id: string
  created_at: string
}

export type FeedRecord = {
  id: string
  record_date: string
  period: '午前' | '午後'
  room_id: string
  amount_kg: number
  worker_id: string
  created_at: string
}

export type DeadRecord = {
  id: string
  record_date: string
  room_id: string
  count: number
  worker_id: string
  created_at: string
}

export type FlockSetting = {
  id: string
  room_id: string
  start_date: string
  initial_count: number
  created_at: string
}

export type FeedDefault = {
  id: string
  room_id: string
  default_kg: number
}

export type Announcement = {
  id: string
  worker_id: string
  text: string
  is_active: boolean
  created_at: string
}

export type BrokenEggRecord = {
  id: string
  record_date: string
  period: '午前' | '午後'
  count: number
  worker_id: string
  created_at: string
}

export type UnknownEggRecord = {
  id: string
  record_date: string
  room_id: string | null
  location: string | null
  location_detail: string | null
  worker_id: string
  created_at: string
}

export type Memo = {
  id: string
  record_date: string
  room_id: string | null
  tab: string
  text: string
  worker_id: string
  created_at: string
}

export type WorkLog = {
  id: string
  record_date: string
  room_id: string | null
  worker_id: string
  category: string | null
  description: string
  created_at: string
}
