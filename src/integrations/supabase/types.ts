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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          action_label: string | null
          action_link: string | null
          body: string
          created_at: string
          dismissed: boolean
          id: string
          scope: string
          title: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_link?: string | null
          body: string
          created_at?: string
          dismissed?: boolean
          id?: string
          scope?: string
          title: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_link?: string | null
          body?: string
          created_at?: string
          dismissed?: boolean
          id?: string
          scope?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          correct_answer: string | null
          created_at: string
          id: string
          kind: string
          options: Json
          points: number
          position: number
          prompt: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          correct_answer?: string | null
          created_at?: string
          id?: string
          kind?: string
          options?: Json
          points?: number
          position?: number
          prompt: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          correct_answer?: string | null
          created_at?: string
          id?: string
          kind?: string
          options?: Json
          points?: number
          position?: number
          prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_submissions: {
        Row: {
          answers: Json
          assessment_id: string
          auto_score: number
          created_at: string
          id: string
          manual_score: number | null
          passed: boolean | null
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          total_points: number
          updated_at: string
        }
        Insert: {
          answers?: Json
          assessment_id: string
          auto_score?: number
          created_at?: string
          id?: string
          manual_score?: number | null
          passed?: boolean | null
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          total_points?: number
          updated_at?: string
        }
        Update: {
          answers?: Json
          assessment_id?: string
          auto_score?: number
          created_at?: string
          id?: string
          manual_score?: number | null
          passed?: boolean | null
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_submissions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          available_from: string | null
          available_until: string | null
          class_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          passing_score: number
          published: boolean
          subject_id: string | null
          time_limit_minutes: number
          title: string
          total_points: number
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          class_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          passing_score?: number
          published?: boolean
          subject_id?: string | null
          time_limit_minutes?: number
          title: string
          total_points?: number
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          passing_score?: number
          published?: boolean
          subject_id?: string | null
          time_limit_minutes?: number
          title?: string
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          points: number
          title: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          points?: number
          title: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          points?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string | null
          created_at: string
          date: string
          id: string
          status: string
          student_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          status?: string
          student_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_profile_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_profile_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
          room: string | null
          subject_id: string | null
          teacher_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          room?: string | null
          subject_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          room?: string | null
          subject_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_profile_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          session_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          session_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "classroom_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_participants: {
        Row: {
          cam_on: boolean
          camera_allowed: boolean
          created_at: string
          hand_raised: boolean
          id: string
          is_host: boolean
          joined_at: string
          left_at: string | null
          mic_on: boolean
          session_id: string
          updated_at: string
          user_id: string
          warned_at: string | null
        }
        Insert: {
          cam_on?: boolean
          camera_allowed?: boolean
          created_at?: string
          hand_raised?: boolean
          id?: string
          is_host?: boolean
          joined_at?: string
          left_at?: string | null
          mic_on?: boolean
          session_id: string
          updated_at?: string
          user_id: string
          warned_at?: string | null
        }
        Update: {
          cam_on?: boolean
          camera_allowed?: boolean
          created_at?: string
          hand_raised?: boolean
          id?: string
          is_host?: boolean
          joined_at?: string
          left_at?: string | null
          mic_on?: boolean
          session_id?: string
          updated_at?: string
          user_id?: string
          warned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classroom_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "classroom_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_sessions: {
        Row: {
          class_id: string
          created_at: string
          ended_at: string | null
          host_id: string
          id: string
          is_active: boolean
          started_at: string
          title: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          ended_at?: string | null
          host_id: string
          id?: string
          is_active?: boolean
          started_at?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          ended_at?: string | null
          host_id?: string
          id?: string
          is_active?: boolean
          started_at?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          title: string | null
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinary_actions: {
        Row: {
          active: boolean
          class_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          issued_by: string | null
          kind: string
          reason: string
          starts_at: string
          student_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          class_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          issued_by?: string | null
          kind?: string
          reason: string
          starts_at?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          class_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          issued_by?: string | null
          kind?: string
          reason?: string
          starts_at?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_actions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinary_actions_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinary_actions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_profiles: {
        Row: {
          created_at: string
          data_points: number
          focus_topic: string | null
          generated_at: string
          learning_style: string | null
          recent_pattern: string | null
          strong_topics: string[]
          student_id: string
          summary: string | null
          updated_at: string
          weak_topics: string[]
        }
        Insert: {
          created_at?: string
          data_points?: number
          focus_topic?: string | null
          generated_at?: string
          learning_style?: string | null
          recent_pattern?: string | null
          strong_topics?: string[]
          student_id: string
          summary?: string | null
          updated_at?: string
          weak_topics?: string[]
        }
        Update: {
          created_at?: string
          data_points?: number
          focus_topic?: string | null
          generated_at?: string
          learning_style?: string | null
          recent_pattern?: string | null
          strong_topics?: string[]
          student_id?: string
          summary?: string | null
          updated_at?: string
          weak_topics?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "learning_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_resources: {
        Row: {
          category: string
          class_id: string
          created_at: string
          created_by: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          lesson_date: string
          mime_type: string | null
          title: string
          url: string | null
        }
        Insert: {
          category?: string
          class_id: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          lesson_date?: string
          mime_type?: string | null
          title: string
          url?: string | null
        }
        Update: {
          category?: string
          class_id?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          lesson_date?: string
          mime_type?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string | null
          category: string
          class_level: string | null
          created_at: string
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          subject_id: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          author?: string | null
          category?: string
          class_level?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          author?: string | null
          category?: string
          class_level?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_books_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      locker_folders: {
        Row: {
          class_level: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          class_level?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          class_level?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locker_folders_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      locker_items: {
        Row: {
          category: string
          class_level: string | null
          created_at: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          folder_id: string | null
          from_missed_work: boolean
          id: string
          kind: string
          mime_type: string | null
          notes: string | null
          owner_id: string
          subject_id: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string
          class_level?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          folder_id?: string | null
          from_missed_work?: boolean
          id?: string
          kind?: string
          mime_type?: string | null
          notes?: string | null
          owner_id: string
          subject_id?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string
          class_level?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          folder_id?: string | null
          from_missed_work?: boolean
          id?: string
          kind?: string
          mime_type?: string | null
          notes?: string | null
          owner_id?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locker_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "locker_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_items_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_items: {
        Row: {
          active: boolean
          class_level: string | null
          cover_url: string | null
          created_at: string
          currency: string
          description: string | null
          duration_minutes: number | null
          id: string
          kind: string
          price_cents: number
          seller_id: string | null
          subject_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          class_level?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          kind?: string
          price_cents?: number
          seller_id?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          class_level?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          kind?: string
          price_cents?: number
          seller_id?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_items_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      missed_work: {
        Row: {
          category: string
          class_id: string | null
          created_at: string
          file_name: string | null
          file_path: string | null
          id: string
          lesson_date: string
          released_to_locker: boolean
          resource_id: string | null
          reviewed: boolean
          reviewed_at: string | null
          student_id: string
          title: string
          url: string | null
        }
        Insert: {
          category?: string
          class_id?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          lesson_date?: string
          released_to_locker?: boolean
          resource_id?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          student_id: string
          title: string
          url?: string | null
        }
        Update: {
          category?: string
          class_id?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          lesson_date?: string
          released_to_locker?: boolean
          resource_id?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          student_id?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missed_work_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missed_work_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "lesson_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          destination: string
          error: string | null
          id: string
          next_attempt_at: string
          notification_id: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          destination: string
          error?: string | null
          id?: string
          next_attempt_at?: string
          notification_id: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          destination?: string
          error?: string | null
          id?: string
          next_attempt_at?: string
          notification_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          sms_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_cents: number
          buyer_id: string
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          item_id: string | null
          item_kind: string
          item_title: string
          notes: string | null
          paid_at: string | null
          payment_link: string | null
          provider: string
          provider_tx_id: string | null
          quantity: number
          reference: string
          scheduled_at: string | null
          status: string
          updated_at: string
          verified_amount_cents: number | null
        }
        Insert: {
          amount_cents?: number
          buyer_id: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          item_id?: string | null
          item_kind?: string
          item_title: string
          notes?: string | null
          paid_at?: string | null
          payment_link?: string | null
          provider?: string
          provider_tx_id?: string | null
          quantity?: number
          reference: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          verified_amount_cents?: number | null
        }
        Update: {
          amount_cents?: number
          buyer_id?: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          item_id?: string | null
          item_kind?: string
          item_title?: string
          notes?: string | null
          paid_at?: string | null
          payment_link?: string | null
          provider?: string
          provider_tx_id?: string | null
          quantity?: number
          reference?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          verified_amount_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "marketplace_items"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_students: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_parent_profile_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_students_student_profile_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string | null
          id: string
          order_reference: string | null
          payload: Json
          processed_at: string | null
          provider: string
          status: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type?: string | null
          id?: string
          order_reference?: string | null
          payload?: Json
          processed_at?: string | null
          provider: string
          status?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string | null
          id?: string
          order_reference?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          school_id: string | null
          student_code: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          school_id?: string | null
          student_code?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          school_id?: string | null
          student_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_events: {
        Row: {
          created_at: string
          day: string
          id: string
          kind: string
          note: string | null
          points: number
          source_id: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          id?: string
          kind: string
          note?: string | null
          points?: number
          source_id?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          kind?: string
          note?: string | null
          points?: number
          source_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_applications: {
        Row: {
          applicant_name: string
          class_level: string | null
          created_at: string
          documents: Json
          email: string | null
          id: string
          intended_program: string | null
          personal_statement: string | null
          phone: string | null
          review_notes: string | null
          reviewed_at: string | null
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          applicant_name: string
          class_level?: string | null
          created_at?: string
          documents?: Json
          email?: string | null
          id?: string
          intended_program?: string | null
          personal_statement?: string | null
          phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          school_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          applicant_name?: string
          class_level?: string | null
          created_at?: string
          documents?: Json
          email?: string | null
          id?: string
          intended_program?: string | null
          personal_statement?: string | null
          phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_applications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_meetings: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          kind: string
          location: string | null
          meeting_url: string | null
          scheduled_at: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          kind?: string
          location?: string | null
          meeting_url?: string | null
          scheduled_at: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          kind?: string
          location?: string | null
          meeting_url?: string | null
          scheduled_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_meetings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      school_members: {
        Row: {
          created_at: string
          id: string
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          status: string
          student_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school_id: string
          status?: string
          student_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string
          status?: string
          student_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_roster: {
        Row: {
          claimed_by: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          student_code: string | null
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id: string
          student_code?: string | null
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string
          student_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_roster_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          admissions_open: boolean
          badges: string[]
          category: string
          city: string | null
          code: string
          contact_email: string | null
          country: string
          created_at: string
          created_by: string | null
          description: string | null
          fees_currency: string
          fees_max: number | null
          fees_min: number | null
          fees_notes: string | null
          id: string
          is_international: boolean
          logo_url: string | null
          name: string
          owner_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          admissions_open?: boolean
          badges?: string[]
          category?: string
          city?: string | null
          code: string
          contact_email?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fees_currency?: string
          fees_max?: number | null
          fees_min?: number | null
          fees_notes?: string | null
          id?: string
          is_international?: boolean
          logo_url?: string | null
          name: string
          owner_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          admissions_open?: boolean
          badges?: string[]
          category?: string
          city?: string | null
          code?: string
          contact_email?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fees_currency?: string
          fees_max?: number | null
          fees_min?: number | null
          fees_notes?: string | null
          id?: string
          is_international?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      study_reminders: {
        Row: {
          active: boolean
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          remind_minutes_before: number
          start_time: string
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          remind_minutes_before?: number
          start_time: string
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          remind_minutes_before?: number
          start_time?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_reminders_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          assignment_id: string
          content: string | null
          created_at: string
          grade: number | null
          graded_at: string | null
          id: string
          status: string
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          assignment_id: string
          content?: string | null
          created_at?: string
          grade?: number | null
          graded_at?: string | null
          id?: string
          status?: string
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          assignment_id?: string
          content?: string | null
          created_at?: string
          grade?: number | null
          graded_at?: string | null
          id?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_profile_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_slots: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_relations: {
        Row: {
          created_at: string
          id: string
          relation: string
          target_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          relation: string
          target_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relation?: string
          target_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_relations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_relations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      award_points: {
        Args: {
          _kind: string
          _note: string
          _points: number
          _source_id: string
          _student_id: string
        }
        Returns: undefined
      }
      can_take_assessment: {
        Args: { _assessment_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_member: { Args: { _user_id: string }; Returns: boolean }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrolled: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_of: {
        Args: { _parent_id: string; _student_id: string }
        Returns: boolean
      }
      is_suspended: { Args: { _user_id: string }; Returns: boolean }
      lookup_school: {
        Args: { _code: string }
        Returns: {
          city: string
          country: string
          id: string
          name: string
        }[]
      }
      my_school_id: { Args: { _user: string }; Returns: string }
      owner_assessment_questions: {
        Args: { _assessment_id: string }
        Returns: {
          assessment_id: string
          correct_answer: string
          id: string
          kind: string
          options: Json
          points: number
          position: number
          prompt: string
        }[]
      }
      owns_assessment: {
        Args: { _assessment_id: string; _user_id: string }
        Returns: boolean
      }
      owns_school: {
        Args: { _school: string; _user: string }
        Returns: boolean
      }
      session_class_id: { Args: { _session_id: string }; Returns: string }
      shares_school: {
        Args: { _school: string; _user: string }
        Returns: boolean
      }
      submit_assessment: {
        Args: { _answers: Json; _submission_id: string }
        Returns: {
          auto_score: number
          manual_pending: boolean
          passed: boolean
          total_points: number
        }[]
      }
      teaches_class: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "parent" | "admin" | "institution"
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
      app_role: ["student", "teacher", "parent", "admin", "institution"],
    },
  },
} as const
