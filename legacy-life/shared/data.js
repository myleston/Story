// 原型用的近似数据：数值是按公开统计粗略取整的示意值，不是精确数据。
// births: 年新生儿（千人），lifeExp: 出生时预期寿命，u5: 五岁以下死亡率（每千人），
// uni: 高等教育入学率，income: 收入档位 1（低）- 4（高），conflict: 是否有较高冲突风险。

export const COUNTRIES = [
  { id: 'IN', name: '印度', births: 23000, lifeExp: { M: 70, F: 73 }, u5: 30, uni: 0.3, income: 2, conflict: false,
    cities: ['孟买', '德里', '加尔各答', '班加罗尔', '勒克瑙', '巴特那'],
    names: { M: ['Arjun', 'Rahul', 'Vikram', 'Imran', 'Suresh'], F: ['Priya', 'Ananya', 'Lakshmi', 'Fatima', 'Kavya'] } },
  { id: 'CN', name: '中国', births: 9000, lifeExp: { M: 76, F: 81 }, u5: 7, uni: 0.6, income: 3, conflict: false,
    cities: ['重庆', '郑州', '广州', '成都', '哈尔滨', '昆明'],
    names: { M: ['子轩', '浩然', '建国', '志强', '宇航'], F: ['欣怡', '梓涵', '秀英', '雨桐', '佳琪'] } },
  { id: 'NG', name: '尼日利亚', births: 8000, lifeExp: { M: 53, F: 54 }, u5: 110, uni: 0.12, income: 1, conflict: true,
    cities: ['拉各斯', '卡诺', '伊巴丹', '阿布贾', '哈科特港'],
    names: { M: ['Chinedu', 'Emeka', 'Musa', 'Tunde', 'Ibrahim'], F: ['Amaka', 'Ngozi', 'Aisha', 'Funmi', 'Zainab'] } },
  { id: 'PK', name: '巴基斯坦', births: 6300, lifeExp: { M: 65, F: 69 }, u5: 60, uni: 0.12, income: 2, conflict: true,
    cities: ['卡拉奇', '拉合尔', '费萨拉巴德', '白沙瓦'],
    names: { M: ['Ali', 'Hamza', 'Bilal', 'Usman'], F: ['Ayesha', 'Hira', 'Sana', 'Mahnoor'] } },
  { id: 'ID', name: '印度尼西亚', births: 4400, lifeExp: { M: 69, F: 73 }, u5: 22, uni: 0.4, income: 2, conflict: false,
    cities: ['雅加达', '泗水', '万隆', '棉兰', '日惹'],
    names: { M: ['Budi', 'Agus', 'Rizky', 'Dimas'], F: ['Siti', 'Dewi', 'Putri', 'Ayu'] } },
  { id: 'ET', name: '埃塞俄比亚', births: 4000, lifeExp: { M: 64, F: 68 }, u5: 47, uni: 0.1, income: 1, conflict: true,
    cities: ['亚的斯亚贝巴', '德雷达瓦', '贡德尔', '默克莱'],
    names: { M: ['Abebe', 'Dawit', 'Tesfaye', 'Yonas'], F: ['Kalkidan', 'Hiwot', 'Selam', 'Meron'] } },
  { id: 'US', name: '美国', births: 3600, lifeExp: { M: 75, F: 80 }, u5: 6, uni: 0.8, income: 4, conflict: false,
    cities: ['俄亥俄州代顿', '休斯敦', '洛杉矶', '亚特兰大', '底特律'],
    names: { M: ['James', 'Carlos', 'Tyler', 'Ethan'], F: ['Emily', 'Maria', 'Jasmine', 'Olivia'] } },
  { id: 'BR', name: '巴西', births: 2500, lifeExp: { M: 72, F: 79 }, u5: 14, uni: 0.55, income: 3, conflict: false,
    cities: ['圣保罗', '里约热内卢', '萨尔瓦多', '福塔莱萨', '马瑙斯'],
    names: { M: ['João', 'Lucas', 'Gabriel', 'Pedro'], F: ['Ana', 'Juliana', 'Larissa', 'Beatriz'] } },
  { id: 'JP', name: '日本', births: 730, lifeExp: { M: 81, F: 87 }, u5: 2, uni: 0.65, income: 4, conflict: false,
    cities: ['大阪', '札幌', '福冈', '名古屋', '仙台'],
    names: { M: ['Haruto', 'Sota', 'Ren', 'Takeshi'], F: ['Yui', 'Sakura', 'Hina', 'Akiko'] } },
  { id: 'DE', name: '德国', births: 690, lifeExp: { M: 79, F: 83 }, u5: 4, uni: 0.7, income: 4, conflict: false,
    cities: ['柏林', '汉堡', '莱比锡', '多特蒙德'],
    names: { M: ['Lukas', 'Jonas', 'Mehmet', 'Felix'], F: ['Anna', 'Lea', 'Sophie', 'Emma'] } },
  { id: 'TW', name: '台湾', births: 135, lifeExp: { M: 77, F: 84 }, u5: 4, uni: 0.85, income: 4, conflict: false,
    cities: ['台北', '台中', '高雄', '台南', '花莲'],
    names: { M: ['承恩', '冠宇', '家豪', '志明'], F: ['怡君', '雅婷', '诗涵', '淑芬'] } },
];

export const countryById = id => COUNTRIES.find(c => c.id === id);

export const DREAMS = ['科学家', '医生', '老师', '足球运动员', '歌手', '宇航员', '画家', '厨师'];

// 职业：edu 表示最低学历要求，wealth 表示对家境的影响
export const JOBS = [
  { key: '工程师', edu: 'university', wealth: 1 },
  { key: '医生', edu: 'university', wealth: 2, knowledge: 60 },
  { key: '老师', edu: 'university', wealth: 0 },
  { key: '公务员', edu: 'university', wealth: 1 },
  { key: '店员', edu: 'secondary', wealth: 0 },
  { key: '司机', edu: 'secondary', wealth: 0 },
  { key: '工厂工人', edu: 'secondary', wealth: 0 },
  { key: '农民', edu: 'none', wealth: -1 },
  { key: '街头小贩', edu: 'none', wealth: -1 },
  { key: '工地工人', edu: 'none', wealth: 0 },
];

export const BUSINESS_LABELS = ['修车铺', '面包店', '小吃店', '裁缝店', '旧书店', '杂货铺'];

export const CAUSES = ['肺炎', '腹泻', '早产并发症', '疟疾', '交通事故', '感染性疾病', '意外', '癌症',
  '暴力冲突', '心脏病', '中风', '慢性呼吸道疾病', '糖尿病', '阿尔茨海默病', '衰老'];

// 留给陌生人的话只能从预设里选：不需要内容审核，也没法被滥用
export const LETTERS = [
  '别害怕走远一点的路。',
  '好好吃饭，好好睡觉。',
  '你出生在哪里，不是你的错，也不是你的功劳。',
  '去爱一个人吧，哪怕会受伤。',
  '记得常给家里打电话。',
  '慢一点也没关系，大家都是第一次活。',
];

// 遗产类型：别人的人生会怎样碰到它
export const LEGACY_TYPES = {
  business: { title: label => `一家${label}`, impact: '在这里找到了第一份工作' },
  school: { title: () => '一所学校', impact: '在这所学校里念了书' },
  clinic: { title: () => '一间诊所', impact: '在这间诊所里被救了回来' },
  park: { title: () => '一片树林', impact: '常常在这片树林里散步' },
  letter: { title: () => '一张写给陌生人的纸条', impact: '读到了这张纸条' },
};

export const WEALTH_LABELS = ['', '赤贫', '贫困', '普通', '小康', '富裕'];
