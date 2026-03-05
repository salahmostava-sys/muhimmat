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
      advance_installments: {
        Row: {
          advance_id: string
          amount: number
          deducted_at: string | null
          id: string
          month_year: string
          status: Database["public"]["Enums"]["installment_status"]
        }
        Insert: {
          advance_id: string
          amount: number
          deducted_at?: string | null
          id?: string
          month_year: string
          status?: Database["public"]["Enums"]["installment_status"]
        }
        Update: {
          advance_id?: string
          amount?: number
          deducted_at?: string | null
          id?: string
          month_year?: string
          status?: Database["public"]["Enums"]["installment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "advance_installments_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
        ]
      }
      advances: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string
          disbursement_date: string
          employee_id: string
          first_deduction_month: string
          id: string
          monthly_amount: number
          note: string | null
          status: Database["public"]["Enums"]["advance_status"]
          total_installments: number
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          created_at?: string
          disbursement_date?: string
          employee_id: string
          first_deduction_month: string
          id?: string
          monthly_amount: number
          note?: string | null
          status?: Database["public"]["Enums"]["advance_status"]
          total_installments?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          disbursement_date?: string
          employee_id?: string
          first_deduction_month?: string
          id?: string
          monthly_amount?: number
          note?: string | null
          status?: Database["public"]["Enums"]["advance_status"]
          total_installments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          due_date: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_resolved: boolean
          resolved_by: string | null
          type: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_resolved?: boolean
          resolved_by?: string | null
          type: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_resolved?: boolean
          resolved_by?: string | null
          type?: string
        }
        Relationships: []
      }
      apps: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          name_en: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          name_en?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          name_en?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          created_by: string | null
          date: string
          employee_id: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          employee_id: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          employee_id?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_orders: {
        Row: {
          app_id: string
          created_at: string
          created_by: string | null
          date: string
          employee_id: string
          id: string
          orders_count: number
          updated_at: string
        }
        Insert: {
          app_id: string
          created_at?: string
          created_by?: string | null
          date: string
          employee_id: string
          id?: string
          orders_count?: number
          updated_at?: string
        }
        Update: {
          app_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          employee_id?: string
          id?: string
          orders_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_orders_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_apps: {
        Row: {
          app_id: string
          employee_id: string
          id: string
          joined_date: string | null
          status: string
          username: string | null
        }
        Insert: {
          app_id: string
          employee_id: string
          id?: string
          joined_date?: string | null
          status?: string
          username?: string | null
        }
        Update: {
          app_id?: string
          employee_id?: string
          id?: string
          joined_date?: string | null
          status?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_apps_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_scheme: {
        Row: {
          assigned_by: string | null
          assigned_date: string
          employee_id: string
          id: string
          scheme_id: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_date?: string
          employee_id: string
          id?: string
          scheme_id: string
        }
        Update: {
          assigned_by?: string | null
          assigned_date?: string
          employee_id?: string
          id?: string
          scheme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_scheme_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_scheme_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "salary_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          allowances: Json | null
          bank_account_number: string | null
          base_salary: number
          city: Database["public"]["Enums"]["city_enum"] | null
          created_at: string
          dob: string | null
          email: string | null
          iban: string | null
          id: string
          id_photo_url: string | null
          is_sponsored: boolean
          job_title: string | null
          join_date: string | null
          license_expiry: string | null
          license_has: boolean
          license_photo_url: string | null
          license_status:
            | Database["public"]["Enums"]["license_status_enum"]
            | null
          name: string
          name_en: string | null
          national_id: string | null
          personal_photo_url: string | null
          phone: string | null
          residency_expiry: string | null
          salary_type: Database["public"]["Enums"]["salary_type"]
          sponsorship_status:
            | Database["public"]["Enums"]["sponsorship_status_enum"]
            | null
          status: Database["public"]["Enums"]["employee_status"]
          trade_register_id: string | null
          updated_at: string
        }
        Insert: {
          allowances?: Json | null
          bank_account_number?: string | null
          base_salary?: number
          city?: Database["public"]["Enums"]["city_enum"] | null
          created_at?: string
          dob?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          id_photo_url?: string | null
          is_sponsored?: boolean
          job_title?: string | null
          join_date?: string | null
          license_expiry?: string | null
          license_has?: boolean
          license_photo_url?: string | null
          license_status?:
            | Database["public"]["Enums"]["license_status_enum"]
            | null
          name: string
          name_en?: string | null
          national_id?: string | null
          personal_photo_url?: string | null
          phone?: string | null
          residency_expiry?: string | null
          salary_type?: Database["public"]["Enums"]["salary_type"]
          sponsorship_status?:
            | Database["public"]["Enums"]["sponsorship_status_enum"]
            | null
          status?: Database["public"]["Enums"]["employee_status"]
          trade_register_id?: string | null
          updated_at?: string
        }
        Update: {
          allowances?: Json | null
          bank_account_number?: string | null
          base_salary?: number
          city?: Database["public"]["Enums"]["city_enum"] | null
          created_at?: string
          dob?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          id_photo_url?: string | null
          is_sponsored?: boolean
          job_title?: string | null
          join_date?: string | null
          license_expiry?: string | null
          license_has?: boolean
          license_photo_url?: string | null
          license_status?:
            | Database["public"]["Enums"]["license_status_enum"]
            | null
          name?: string
          name_en?: string | null
          national_id?: string | null
          personal_photo_url?: string | null
          phone?: string | null
          residency_expiry?: string | null
          salary_type?: Database["public"]["Enums"]["salary_type"]
          sponsorship_status?:
            | Database["public"]["Enums"]["sponsorship_status_enum"]
            | null
          status?: Database["public"]["Enums"]["employee_status"]
          trade_register_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_trade_register_id_fkey"
            columns: ["trade_register_id"]
            isOneToOne: false
            referencedRelation: "trade_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      external_deductions: {
        Row: {
          amount: number
          apply_month: string
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_by: string | null
          created_at: string
          employee_id: string
          id: string
          incident_date: string | null
          note: string | null
          source_app_id: string | null
          type: Database["public"]["Enums"]["deduction_type"]
        }
        Insert: {
          amount: number
          apply_month: string
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_by?: string | null
          created_at?: string
          employee_id: string
          id?: string
          incident_date?: string | null
          note?: string | null
          source_app_id?: string | null
          type?: Database["public"]["Enums"]["deduction_type"]
        }
        Update: {
          amount?: number
          apply_month?: string
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          incident_date?: string | null
          note?: string | null
          source_app_id?: string | null
          type?: Database["public"]["Enums"]["deduction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "external_deductions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_deductions_source_app_id_fkey"
            columns: ["source_app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          paid_by: string | null
          status: string | null
          type: Database["public"]["Enums"]["maintenance_type"]
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          paid_by?: string | null
          status?: string | null
          type?: Database["public"]["Enums"]["maintenance_type"]
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          paid_by?: string | null
          status?: string | null
          type?: Database["public"]["Enums"]["maintenance_type"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      pl_records: {
        Row: {
          cost_deductions: number
          cost_other: number
          cost_salaries: number
          cost_vehicles: number
          created_at: string
          created_by: string | null
          id: string
          month_year: string
          notes: string | null
          revenue_other: number
          revenue_riders: number
        }
        Insert: {
          cost_deductions?: number
          cost_other?: number
          cost_salaries?: number
          cost_vehicles?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month_year: string
          notes?: string | null
          revenue_other?: number
          revenue_riders?: number
        }
        Update: {
          cost_deductions?: number
          cost_other?: number
          cost_salaries?: number
          cost_vehicles?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month_year?: string
          notes?: string | null
          revenue_other?: number
          revenue_riders?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string | null
          name_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          is_active?: boolean
          name?: string | null
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          name_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      salary_records: {
        Row: {
          advance_deduction: number
          allowances: number
          approved_at: string | null
          approved_by: string | null
          attendance_deduction: number
          base_salary: number
          created_at: string
          employee_id: string
          external_deduction: number
          id: string
          is_approved: boolean
          manual_deduction: number
          manual_deduction_note: string | null
          month_year: string
          net_salary: number
          updated_at: string
        }
        Insert: {
          advance_deduction?: number
          allowances?: number
          approved_at?: string | null
          approved_by?: string | null
          attendance_deduction?: number
          base_salary?: number
          created_at?: string
          employee_id: string
          external_deduction?: number
          id?: string
          is_approved?: boolean
          manual_deduction?: number
          manual_deduction_note?: string | null
          month_year: string
          net_salary?: number
          updated_at?: string
        }
        Update: {
          advance_deduction?: number
          allowances?: number
          approved_at?: string | null
          approved_by?: string | null
          attendance_deduction?: number
          base_salary?: number
          created_at?: string
          employee_id?: string
          external_deduction?: number
          id?: string
          is_approved?: boolean
          manual_deduction?: number
          manual_deduction_note?: string | null
          month_year?: string
          net_salary?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_scheme_tiers: {
        Row: {
          created_at: string
          from_orders: number
          id: string
          price_per_order: number
          scheme_id: string
          tier_order: number
          to_orders: number | null
        }
        Insert: {
          created_at?: string
          from_orders?: number
          id?: string
          price_per_order: number
          scheme_id: string
          tier_order?: number
          to_orders?: number | null
        }
        Update: {
          created_at?: string
          from_orders?: number
          id?: string
          price_per_order?: number
          scheme_id?: string
          tier_order?: number
          to_orders?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_scheme_tiers_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "salary_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_schemes: {
        Row: {
          created_at: string
          id: string
          name: string
          name_en: string | null
          status: Database["public"]["Enums"]["scheme_status"]
          target_bonus: number | null
          target_orders: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_en?: string | null
          status?: Database["public"]["Enums"]["scheme_status"]
          target_bonus?: number | null
          target_orders?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_en?: string | null
          status?: Database["public"]["Enums"]["scheme_status"]
          target_bonus?: number | null
          target_orders?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      trade_registers: {
        Row: {
          cr_number: string | null
          created_at: string
          id: string
          name: string
          name_en: string | null
          notes: string | null
        }
        Insert: {
          cr_number?: string | null
          created_at?: string
          id?: string
          name: string
          name_en?: string | null
          notes?: string | null
        }
        Update: {
          cr_number?: string | null
          created_at?: string
          id?: string
          name?: string
          name_en?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          id: string
          permission_key: string
          user_id: string
        }
        Insert: {
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          permission_key: string
          user_id: string
        }
        Update: {
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          permission_key?: string
          user_id?: string
        }
        Relationships: []
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
      vehicle_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string | null
          id: string
          notes: string | null
          reason: string | null
          start_date: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          start_date?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          start_date?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          insurance_expiry: string | null
          model: string | null
          notes: string | null
          plate_number: string
          registration_expiry: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          insurance_expiry?: string | null
          model?: string | null
          notes?: string | null
          plate_number: string
          registration_expiry?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          insurance_expiry?: string | null
          model?: string | null
          notes?: string | null
          plate_number?: string
          registration_expiry?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      advance_status: "active" | "completed" | "paused"
      app_role: "admin" | "hr" | "finance" | "operations" | "viewer"
      approval_status: "pending" | "approved" | "rejected"
      attendance_status: "present" | "absent" | "leave" | "sick" | "late"
      city_enum: "makkah" | "jeddah"
      deduction_type: "fine" | "return" | "delay" | "accident" | "other"
      employee_status: "active" | "inactive" | "ended"
      installment_status: "pending" | "deducted" | "deferred"
      license_status_enum: "has_license" | "no_license" | "applied"
      maintenance_type: "routine" | "breakdown" | "accident"
      salary_type: "shift" | "orders"
      scheme_status: "active" | "archived"
      sponsorship_status_enum:
        | "sponsored"
        | "not_sponsored"
        | "absconded"
        | "terminated"
      vehicle_status: "active" | "maintenance" | "inactive"
      vehicle_type: "motorcycle" | "car"
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
      advance_status: ["active", "completed", "paused"],
      app_role: ["admin", "hr", "finance", "operations", "viewer"],
      approval_status: ["pending", "approved", "rejected"],
      attendance_status: ["present", "absent", "leave", "sick", "late"],
      city_enum: ["makkah", "jeddah"],
      deduction_type: ["fine", "return", "delay", "accident", "other"],
      employee_status: ["active", "inactive", "ended"],
      installment_status: ["pending", "deducted", "deferred"],
      license_status_enum: ["has_license", "no_license", "applied"],
      maintenance_type: ["routine", "breakdown", "accident"],
      salary_type: ["shift", "orders"],
      scheme_status: ["active", "archived"],
      sponsorship_status_enum: [
        "sponsored",
        "not_sponsored",
        "absconded",
        "terminated",
      ],
      vehicle_status: ["active", "maintenance", "inactive"],
      vehicle_type: ["motorcycle", "car"],
    },
  },
} as const
