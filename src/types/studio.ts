export type BlockType = 
  | 'list_menu'
  | 'text'
  | 'image'
  | 'ai_question'
  | 'task'
  | 'webhook';

export interface ListMenuRow {
  id: string;
  title: string;
  description: string;
  targetBlockId?: string;
}

export interface ListMenuData {
  type: 'list_menu';
  header?: string;
  body: string;
  footer?: string;
  buttonText: string;
  sectionTitle?: string;
  rows: ListMenuRow[];
  targetBlockId?: string;
}

export interface TextData {
  type: 'text';
  text: string;
  targetBlockId?: string;
}

export interface ImageData {
  type: 'image';
  imageUrl: string;
  caption?: string;
  targetBlockId?: string;
}

export interface AiQuestionData {
  type: 'ai_question';
  systemPrompt: string;
  contextInfo: string;
  fallbackText: string;
  model: string;
  targetBlockId?: string;
}

export interface TaskData {
  type: 'task';
  taskTitleTemplate: string;
  category: 'delivery' | 'pickup' | 'containers' | 'tracking' | 'general';
  urgency: 'low' | 'normal' | 'urgent';
  assignedTo: string;
  confirmationMessage: string;
  targetBlockId?: string;
}

export interface WebhookData {
  type: 'webhook';
  endpointUrl: string;
  method: 'POST' | 'GET';
  bodyTemplate: string;
  targetBlockId?: string;
}

export type BlockData = 
  | ListMenuData
  | TextData
  | ImageData
  | AiQuestionData
  | TaskData
  | WebhookData;

export interface StudioNode {
  id: string;
  type: BlockType;
  title: string;
  description?: string;
  position: { x: number; y: number };
  data: BlockData;
  isRoot?: boolean;
}

export interface StudioEdge {
  id: string;
  source: string;
  sourceHandle?: string; // e.g. rowId for list_menu or 'default'
  target: string;
}

export interface FlowTree {
  id: string;
  name: string;
  businessName: string;
  businessNumber: string;
  rootBlockId: string;
  nodes: StudioNode[];
  edges: StudioEdge[];
  updatedAt: string;
}

export interface JoniWebhookPayload {
  from: string;
  text?: string;
  listReplyId?: string;
  rowId?: string;
  id?: string;
  newConversation?: boolean;
  timestamp?: string | number;
  customerName?: string;
}

export interface LogEntry {
  id: string;
  from: string;
  customer_name?: string;
  incoming_text: string;
  selected_menu_id?: string;
  selected_menu_title?: string;
  sent_response: string;
  response_type: BlockType | 'fallback_text' | 'unknown';
  timestamp: string;
  channel: 'joni' | 'meta' | 'simulator';
  status: 'sent' | 'delivered' | 'fallback_text' | 'error';
  task_id?: string;
  task_title?: string;
  meta_message_id?: string;
  raw_payload?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  direction: 'incoming' | 'outgoing';
  text: string;
  type: BlockType | 'text' | 'list_menu';
  timestamp: string;
  menuDetails?: {
    header?: string;
    body?: string;
    footer?: string;
    rows?: ListMenuRow[];
    selectedRowId?: string;
  };
}

export interface Conversation {
  id: string;
  from: string;
  customerName: string;
  lastMessage: string;
  lastTimestamp: string;
  selectedMenuId?: string;
  selectedMenuTitle?: string;
  status: 'active' | 'closed' | 'waiting_customer';
  messages: ChatMessage[];
}

export interface StudioTask {
  id: string;
  clientPhone: string;
  clientName: string;
  title: string;
  description: string;
  category: 'delivery' | 'pickup' | 'containers' | 'tracking' | 'general';
  priority: 'low' | 'normal' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  createdAt: string;
  conversationId?: string;
}

export interface StudioSettings {
  businessName: string;
  businessNumber: string;
  firebaseSendUrl: string;
  firebaseRootUrl?: string;
  firebasePath?: string;
  waitTimeSeconds: number;
  metaPhoneNumberId: string;
  metaAccessToken: string;
  enableMetaCloudApi: boolean;
  enableJoniBridge: boolean;
  defaultFallbackToText: boolean;
  language: string;
  webhookBaseUrl: string;
  metaVerifiedName?: string;
  metaDisplayPhone?: string;
  metaConnectionStatus?: string;
  lastCheckResult?: string;
  lastMessageIdSent?: string;
}
