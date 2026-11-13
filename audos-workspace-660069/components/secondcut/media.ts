/* Real frames, cast sheets and finished films from this Vidverge account (Script-to-Video
   films 61, 62, 63, 68, 79, 80, 100 and 103). Keys match the second-design mockup. */
const S2V = 'https://storage.googleapis.com/audos-images/workspaces/f24710e5-7c6d-4db4-92b4-c2c235877575/uploads/s2v/';
const FRAMES = 'https://storage.googleapis.com/audos-images/workspaces/f24710e5-7c6d-4db4-92b4-c2c235877575/video-frames/';
const CHAT = 'https://storage.googleapis.com/audos-images/chat-attachments/';
const GEN = 'https://storage.googleapis.com/audos-images/generated-images/';

export const MEDIA: Record<string, string> = {
  film_103_morning: CHAT + '0a199645-c576-4c97-9dfe-150aed410184.png',
  film_68_the: CHAT + '4738d283-d827-4e74-94a8-c38b32cb0774.png',
  film_80_ocean: CHAT + 'f11d4615-e6f4-4e41-b563-34e5f756ddd0.png',
  film_62_audos: CHAT + '4cbdff11-4e10-48eb-9fe9-e326ecfe69c0.png',
  frame_103_b0: S2V + '3cd0a45f-9032-4b0d-81ad-994082a3dc0d.png',
  frame_103_b1: FRAMES + '210d0835-c1da-4800-beca-375b7664020c-6-7900ms.png',
  frame_103_b2: FRAMES + '4e5e6857-df50-45d0-bd11-f8e5a9b73650-6-7900ms.png',
  frame_103_b3: FRAMES + '1fa24448-f8a6-4220-ba1b-71d61643dac4-6-5900ms.png',
  frame_68_b0: S2V + 'db2faa18-5041-418a-8548-42903c752d3e.png',
  frame_68_b1: S2V + 'a3ee6cdd-92aa-468c-8194-123cfb69407c.png',
  frame_68_b2: S2V + 'c48bb443-fbb3-40a7-86ab-a2d89fa4e5e6.png',
  frame_80_b0: S2V + '51568ef0-b454-4be3-9f2e-8501f4f07615.png',
  frame_62_b0: 'https://storage.googleapis.com/audos-images/uploads/s2v/2327c287-a4c4-4c9d-9afa-5e461a7bf41e.png',
  frame_62_b1: 'https://storage.googleapis.com/audos-images/uploads/s2v/f7feb303-5137-49d9-b480-b1c1ca4c831e.png',
  frame_62_b2: 'https://storage.googleapis.com/audos-images/uploads/s2v/9f3f1ffa-e446-4b56-b2b2-0d1767c2e4e1.png',
  char_103_father: GEN + 'image-1793646279046-gyoqrd.png',
  char_103_son: GEN + 'image-1793646311933-n83mxa.png',
  char_100_father: CHAT + '57eba24b-b1bf-4148-b8f9-10e5b30e8002.jpg',
  char_100_son: CHAT + '699b32be-b9ba-462d-9bd0-4186d54d0742.jpg',
  char_100_narrator: CHAT + '013f60cc-7cc0-4cb6-82b1-78ed65bd4899.jpg',
  char_79_presenter: CHAT + 'b811ef69-3a0b-4b94-9792-6475ba1d2520.jpg',
  char_68_maya: CHAT + '0a69954d-4649-4841-b837-29908a8cd9f2.jpg',
  char_68_eli: CHAT + '531d458c-ba4f-44dd-82e3-96e2dca9232d.jpg',
  char_63_the: CHAT + '53ae2806-70ea-4e91-89ec-83a5bf837fd7.jpg',
  char_63_thex: CHAT + '441011e7-1b82-43fc-a2f2-6f733115ea03.jpg',
  char_63_thexx: CHAT + '4e7c4657-9338-4d66-8d96-29db4dd718b6.jpg',
  char_63_thexxx: CHAT + '24859e12-337b-4a2f-9aac-8bc15043c4de.jpg',
  char_62_apartment: CHAT + '73b5169f-d76e-4a93-bcf4-a22db2f4e0c3.jpg',
  char_61_studio: CHAT + '6e18536e-d9f9-4bc8-9d4b-a738ddaf0bcd.jpg',
};

export const VIDEO: Record<string, string> = {
  film_103_morning: 'https://storage.googleapis.com/audos-images/workspaces/f24710e5-7c6d-4db4-92b4-c2c235877575/uploads/s2v/16e8209a-3e80-42f0-b84e-4b76a71c9443.mp4',
  frame_62_b1: 'https://storage.googleapis.com/audos-images/runway/f24710e5-7c6d-4db4-92b4-c2c235877575/rw_2d12ee49-bd18-406b-b0c2-1b2d9328af68-0.mp4',
  frame_103_b1: 'https://storage.googleapis.com/audos-images/generated-videos/omni-omni_1794323457917_e3re46.mp4',
  film_80_ocean: 'https://storage.googleapis.com/audos-images/workspaces/f24710e5-7c6d-4db4-92b4-c2c235877575/uploads/s2v/2a06a378-0a54-4d16-948b-ee02e0034802.mp4',
  frame_68_b0: 'https://storage.googleapis.com/audos-images/generated-videos/openrouter-gen-vid-1792675257-6GY31u097cDRQNSlQNIO-1792675601229.mp4',
  frame_103_b2: 'https://storage.googleapis.com/audos-images/generated-videos/omni-omni_1794323540504_02vk5b.mp4',
  film_62_audos: 'https://storage.googleapis.com/audos-images/uploads/s2v/df76b31f-aa6d-48a2-a5e5-058ea36f30e4.mp4',
  frame_68_b1: 'https://storage.googleapis.com/audos-images/generated-videos/openrouter-gen-vid-1792676974-nP0Rq0KxkS3S2FDZjdyN-1792677252335.mp4',
};
