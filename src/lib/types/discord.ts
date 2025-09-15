/**
 * Discord API Types
 * 
 * Core types for Discord message data, channels, and API responses.
 * These types define the structure of data received from Discord's API.
 */

export interface DiscordMessage {
  id: string;
  content: string;
  timestamp: string;
  channel_id: string;
  author: {
    username: string;
    discriminator: string;
    avatar: string;
    global_name: string;
    id: string;
  };
  reactions?: {
    emoji: {
      id?: string;
      name?: string;
    };
    count: number;
  }[];
  embeds?: {
    type?: string;
    url?: string;
    title?: string;
    description?: string;
    timestamp?: string;
    fields?: { name: string; value: string; inline?: boolean }[];
    author?: {
      name: string;
      icon_url?: string;
      proxy_icon_url?: string;
    };
    footer?: {
      text: string;
    };
    thumbnail?: {
      url: string;
      proxy_url?: string;
      width?: number;
      height?: number;
      content_type?: string;
      placeholder?: string;
      placeholder_version?: number;
      flags?: number;
    };
    image?: {
      url: string;
      proxy_url?: string;
      width?: number;
      height?: number;
      content_type?: string;
      placeholder?: string;
      placeholder_version?: number;
      flags?: number;
    };
    content_scan_version?: number;
  }[];
  referenced_message?: {
    author: {
      username: string;
      discriminator: string;
      avatar: string;
      global_name: string;
      id: string;
    }
    content: string;
  };
  attachments?: {
    url: string;
    filename: string;
    content_type: string;
    size: number;
    id: string;
    width?: number;
    height?: number;
  }[];
}

export interface PermissionOverwrite {
  id: string;
  type: number;
  allow: string;
  deny: string;
}

export interface DiscordChannel {
  id: string;
  type: number;
  guild_id?: string;
  position: number;
  permission_overwrites: PermissionOverwrite[];
  name: string;
  topic?: string | null;
  nsfw?: boolean;
  last_message_id?: string | null;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  recipients?: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string;
    global_name?: string;
  }[];
  icon?: string | null;
  owner_id?: string;
  application_id?: string;
  parent_id?: string | null;
  last_pin_timestamp?: string | null;
  rtc_region?: string | null;
  video_quality_mode?: number;
  message_count?: number;
  member_count?: number;
  thread_metadata?: {
    archived: boolean;
    auto_archive_duration: number;
    archive_timestamp: string;
    locked: boolean;
    invitable?: boolean;
    create_timestamp?: string | null;
  };
  member?: {
    id?: string;
    user_id?: string;
    join_timestamp: string;
    flags: number;
  };
  default_auto_archive_duration?: number;
  permissions?: string;
  flags?: number;
  total_message_sent?: number;
  available_tags?: string[];
  applied_tags?: string[];
  default_reaction_emoji?: string | null;
  default_thread_rate_limit_per_user?: number;
  default_sort_order?: number | null;
  default_forum_layout?: number;
  hasActivity?: boolean;
  lastMessageTimestamp?: string | null;
  messageCount?: number;
  messages?: DiscordMessage[];
}

export interface DiscordMessagesResponse {
  messages: DiscordMessage[];
}