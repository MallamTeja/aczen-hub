export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          recipient_clerk_user_id: string
          sender_clerk_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          recipient_clerk_user_id: string
          sender_clerk_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          recipient_clerk_user_id?: string
          sender_clerk_user_id?: string
        }
        Relationships: []
      }
      company_events: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          event_type: string
          id: string
          location: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          event_type?: string
          id?: string
          location?: string | null
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          event_type?: string
          id?: string
          location?: string | null
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_lead_activities: {
        Row: {
          actor_name: string | null
          actor_user_id: string
          body: string | null
          created_at: string
          from_stage: string | null
          id: string
          lead_id: string
          title: string
          to_stage: string | null
          type: string
        }
        Insert: {
          actor_name?: string | null
          actor_user_id: string
          body?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          lead_id: string
          title: string
          to_stage?: string | null
          type: string
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string
          body?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          lead_id?: string
          title?: string
          to_stage?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          company: string | null
          created_at: string
          created_by: string
          currency: string
          email: string | null
          expected_close: string | null
          id: string
          job_title: string | null
          last_contacted_at: string | null
          name: string
          notes: string | null
          owner_name: string | null
          owner_user_id: string | null
          phone: string | null
          probability: number
          source: string | null
          stage: string
          tags: string[]
          updated_at: string
          value: number
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by: string
          currency?: string
          email?: string | null
          expected_close?: string | null
          id?: string
          job_title?: string | null
          last_contacted_at?: string | null
          name: string
          notes?: string | null
          owner_name?: string | null
          owner_user_id?: string | null
          phone?: string | null
          probability?: number
          source?: string | null
          stage?: string
          tags?: string[]
          updated_at?: string
          value?: number
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          email?: string | null
          expected_close?: string | null
          id?: string
          job_title?: string | null
          last_contacted_at?: string | null
          name?: string
          notes?: string | null
          owner_name?: string | null
          owner_user_id?: string | null
          phone?: string | null
          probability?: number
          source?: string | null
          stage?: string
          tags?: string[]
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      lead_uploads: {
        Row: {
          clerk_user_id: string
          created_at: string
          file_name: string
          id: string
          lead_source: string | null
          total_leads: number
          upload_date: string
          uploaded_by: string | null
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          file_name: string
          id?: string
          lead_source?: string | null
          total_leads?: number
          upload_date?: string
          uploaded_by?: string | null
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          file_name?: string
          id?: string
          lead_source?: string | null
          total_leads?: number
          upload_date?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          clerk_user_id: string
          id: string
          leave_type: string
          total_allowed: number
          updated_at: string
          used: number
          year: number
        }
        Insert: {
          clerk_user_id: string
          id?: string
          leave_type: string
          total_allowed?: number
          updated_at?: string
          used?: number
          year?: number
        }
        Update: {
          clerk_user_id?: string
          id?: string
          leave_type?: string
          total_allowed?: number
          updated_at?: string
          used?: number
          year?: number
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          clerk_user_id: string
          created_at: string
          end_date: string
          id: string
          leave_type: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          start_date: string
          status: string
          total_days: number
          updated_at: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          end_date: string
          id?: string
          leave_type: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          start_date: string
          status?: string
          total_days?: number
          updated_at?: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          start_date?: string
          status?: string
          total_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          clerk_user_id: string
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          title: string
          type: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          title: string
          type?: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      punches: {
        Row: {
          clerk_user_id: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          status: string
          timestamp: string
          verification_code: string | null
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          status: string
          timestamp?: string
          verification_code?: string | null
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          status?: string
          timestamp?: string
          verification_code?: string | null
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          avatar_url: string | null
          connected_by: string
          created_at: string
          display_name: string | null
          handle: string
          id: string
          is_active: boolean
          platform: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          connected_by: string
          created_at?: string
          display_name?: string | null
          handle: string
          id?: string
          is_active?: boolean
          platform: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          connected_by?: string
          created_at?: string
          display_name?: string | null
          handle?: string
          id?: string
          is_active?: boolean
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          author_name: string | null
          author_user_id: string
          campaign: string | null
          content: string
          created_at: string
          engagement: Json
          id: string
          link_url: string | null
          media_urls: string[]
          notes: string | null
          platforms: string[]
          published_at: string | null
          scheduled_at: string | null
          status: string
          tags: string[]
          title: string | null
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          author_user_id: string
          campaign?: string | null
          content: string
          created_at?: string
          engagement?: Json
          id?: string
          link_url?: string | null
          media_urls?: string[]
          notes?: string | null
          platforms?: string[]
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          author_user_id?: string
          campaign?: string | null
          content?: string
          created_at?: string
          engagement?: Json
          id?: string
          link_url?: string | null
          media_urls?: string[]
          notes?: string | null
          platforms?: string[]
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_by: string
          assigned_to: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          last_activity: string
          priority: string
          remarks: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          last_activity?: string
          priority?: string
          remarks?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          last_activity?: string
          priority?: string
          remarks?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_emails: {
        Row: {
          body: string
          cc_recipients: string[] | null
          created_at: string
          id: string
          location_label: string | null
          location_url: string | null
          reply_to_id: string | null
          sender_clerk_user_id: string
          subject: string
          tagged_user_ids: string[] | null
          thread_id: string | null
          to_recipients: string[]
        }
        Insert: {
          body: string
          cc_recipients?: string[] | null
          created_at?: string
          id?: string
          location_label?: string | null
          location_url?: string | null
          reply_to_id?: string | null
          sender_clerk_user_id: string
          subject: string
          tagged_user_ids?: string[] | null
          thread_id?: string | null
          to_recipients?: string[]
        }
        Update: {
          body?: string
          cc_recipients?: string[] | null
          created_at?: string
          id?: string
          location_label?: string | null
          location_url?: string | null
          reply_to_id?: string | null
          sender_clerk_user_id?: string
          subject?: string
          tagged_user_ids?: string[] | null
          thread_id?: string | null
          to_recipients?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "fk_thread"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_emails_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          auth_user_id: string | null
          blood_group: string | null
          clerk_user_id: string
          created_at: string
          email: string
          id: string
          name: string
          position: string | null
          role: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          blood_group?: string | null
          clerk_user_id: string
          created_at?: string
          email: string
          id?: string
          name?: string
          position?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          blood_group?: string | null
          clerk_user_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          position?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_updates: {
        Row: {
          clerk_user_id: string
          content: string
          created_at: string
          id: string
          update_date: string
        }
        Insert: {
          clerk_user_id: string
          content: string
          created_at?: string
          id?: string
          update_date?: string
        }
        Update: {
          clerk_user_id?: string
          content?: string
          created_at?: string
          id?: string
          update_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_calendar_counts: {
        Args: {
          end_date: string
          start_date: string
          user_identifiers: string[]
        }
        Returns: {
          completed: number
          overdue_open: number
          task_date: string
          total: number
        }[]
      }
      get_user_calendar_tasks: {
        Args: {
          end_date: string
          start_date: string
          user_identifiers: string[]
        }
        Returns: {
          assigned_by: string
          assigned_to: string
          created_at: string
          description: string
          due_date: string
          id: string
          priority: string
          remarks: string
          status: string
          title: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
