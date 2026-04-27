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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      events: {
        Row: {
          allow_rrpp_guests: boolean
          capacity: number
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          image_url: string | null
          is_free_pass: boolean
          free_pass_until: string | null
          location: string
          organization_id: string | null
          rrpp_guests_per_promoter: number
          consumo_general_requirement: number
          consumo_vip_requirement: number
          time: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_rrpp_guests?: boolean
          capacity?: number
          created_at?: string
          created_by?: string | null
          date: string
          description?: string
          id?: string
          image_url?: string | null
          is_free_pass?: boolean
          free_pass_until?: string | null
          location: string
          organization_id?: string | null
          rrpp_guests_per_promoter?: number
          consumo_general_requirement?: number
          consumo_vip_requirement?: number
          time: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_rrpp_guests?: boolean
          capacity?: number
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          image_url?: string | null
          is_free_pass?: boolean
          free_pass_until?: string | null
          location?: string
          organization_id?: string | null
          rrpp_guests_per_promoter?: number
          consumo_general_requirement?: number
          consumo_vip_requirement?: number
          time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          checked_in_at: string | null
          code: string
          created_at: string
          event_id: string
          guest_name: string | null
          id: string
          quantity: number
          rrpp_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_type_id: string
          type: Database["public"]["Enums"]["ticket_type"]
          user_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          code: string
          created_at?: string
          event_id: string
          guest_name?: string | null
          id?: string
          quantity?: number
          rrpp_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_type_id: string
          type?: Database["public"]["Enums"]["ticket_type"]
          user_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          code?: string
          created_at?: string
          event_id?: string
          guest_name?: string | null
          id?: string
          quantity?: number
          rrpp_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_type_id?: string
          type?: Database["public"]["Enums"]["ticket_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      rrpp_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          is_team_leader: boolean | null
          organization_id: string | null
          unique_code: string
          user_id: string
          zone_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          is_team_leader?: boolean | null
          organization_id?: string | null
          unique_code: string
          user_id: string
          zone_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          is_team_leader?: boolean | null
          organization_id?: string | null
          unique_code?: string
          user_id?: string
          zone_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rrpp_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rrpp_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          price: number
          quantity: number
          sold: number
          type: Database["public"]["Enums"]["ticket_type"]
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          price?: number
          quantity?: number
          sold?: number
          type?: Database["public"]["Enums"]["ticket_type"]
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          price?: number
          quantity?: number
          sold?: number
          type?: Database["public"]["Enums"]["ticket_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_ticket_code: { Args: { prefix: string }; Returns: string }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["org_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "rrpp" | "user" | "super_admin"
      org_role: "owner" | "admin" | "staff"
      ticket_status: "pending" | "active" | "used" | "cancelled"
      ticket_type: "normal" | "vip" | "mesa_vip" | "rrpp_free" | "rrpp_paid"
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
    Enums: {
      app_role: ["admin", "rrpp", "user", "super_admin"],
      org_role: ["owner", "admin", "staff"],
      ticket_status: ["pending", "active", "used", "cancelled"],
      ticket_type: ["normal", "vip", "mesa_vip", "rrpp_free", "rrpp_paid"],
    },
  },
} as const
