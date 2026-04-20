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
    PostgrestVersion: "14.1"
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
      lead_uploads: {
        Row: {
          clerk_user_id: string
          created_at: string
          file_name: string
          id: string
          lead_source: string
          total_leads: number
          upload_date: string
          uploaded_by: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          file_name: string
          id?: string
          lead_source: string
          total_leads?: number
          upload_date?: string
          uploaded_by: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          file_name?: string
          id?: string
          lead_source?: string
          total_leads?: number
          upload_date?: string
          uploaded_by?: string
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
      punchloc: {
        Row: {
          created_at: string | null
          device_info: string | null
          id: string
          latitude: number
          location_address: string | null
          longitude: number
          punch_type: string
          punched_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          latitude: number
          location_address?: string | null
          longitude: number
          punch_type: string
          punched_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          latitude?: number
          location_address?: string | null
          longitude?: number
          punch_type?: string
          punched_at?: string | null
          updated_at?: string | null
          user_id?: string
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
          last_activity: string | null
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
          last_activity?: string | null
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
          last_activity?: string | null
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
          clerk_user_id: string
          created_at: string
          email: string | null
          id: string
          name: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
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
