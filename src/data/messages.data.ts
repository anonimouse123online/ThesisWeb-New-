export interface Attachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  isImage: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  attachment?: Attachment;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
}

export interface Conversation {
  id: string;
  type: 'group' | 'dm';
  name: string;
  subtitle: string;
  avatar: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
  messages: Message[];
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

export const CURRENT_USER = {
  id: 'u-me',
  name: 'Me'
};

export const CONTACTS: Contact[] = [
  { id: 'u-1', name: 'Alice', role: 'Developer', avatar: 'A' },
  { id: 'u-2', name: 'Bob', role: 'Designer', avatar: 'B' },
  { id: 'u-3', name: 'Charlie', role: 'Project Manager', avatar: 'C' },
];

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'c-1',
    type: 'dm',
    name: 'Alice',
    subtitle: 'Developer',
    avatar: 'A',
    lastMessage: 'Hello there!',
    lastTime: '10:00 AM',
    unread: 1,
    messages: [
      { id: 'm-1', senderId: 'u-1', senderName: 'Alice', text: 'Hello there!', time: '10:00 AM' }
    ]
  },
  {
    id: 'c-2',
    type: 'group',
    name: 'Foundation Crew',
    subtitle: '3 members',
    avatar: 'F',
    lastMessage: 'Let\'s start the project.',
    lastTime: 'Yesterday',
    unread: 0,
    messages: [
      { id: 'm-2', senderId: 'u-2', senderName: 'Bob', text: 'Let\'s start the project.', time: 'Yesterday' }
    ]
  }
];
