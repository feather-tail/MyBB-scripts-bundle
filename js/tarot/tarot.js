(() => {
  'use strict';

  const deck = [
    {
      name: 'Шут',
      image: 'https://feathertail.ru/images/tarot/elder/fool.jpg',
      description:
        'Прямо: новое начало, возможность, риск, свобода, беспечность, спонтанность.',
      descriptionTwo:
        'Перевернуто: разрушение, неосмотрительность, беспечность, опасность, несбалансированность.',
    },
    {
      name: 'Маг',
      image: 'https://feathertail.ru/images/tarot/elder/magician.jpg',
      description:
        'Прямо: сила воли, творческие способности, умение взаимодействовать с миром, уверенность, умение решать проблемы.',
      descriptionTwo:
        'Перевернуто: манипуляция, обман, неспособность к действию, нерешительность, неуверенность.',
    },
    {
      name: 'Верховная жрица',
      image: 'https://feathertail.ru/images/tarot/elder/high-priestess.jpg',
      description:
        'Прямо: интуиция, знание, мудрость, тайны, женственность, пассивность.',
      descriptionTwo:
        'Перевернуто: неискренность, обман, незнание, заблуждение, негативная эмоциональность.',
    },
    {
      name: 'Императрица',
      image: 'https://feathertail.ru/images/tarot/elder/empress.jpg',
      description:
        'Прямо: рождение, материнство, плодородие, чувственность, благополучие, любовь.',
      descriptionTwo:
        'Перевернуто: неплодородность, потеря, разочарование, болезнь, одиночество.',
    },
    {
      name: 'Император',
      image: 'https://feathertail.ru/images/tarot/elder/emperor.jpg',
      description:
        'Прямо: власть, стабильность, организация, авторитет, защита, рациональность.',
      descriptionTwo:
        'Перевернуто: безвластность, неуверенность, хаос, неорганизованность, жестокость.',
    },
    {
      name: 'Иерофант',
      image: 'https://feathertail.ru/images/tarot/elder/hierophant.jpg',
      description:
        'Прямо: религия, традиции, моральные убеждения, авторитет, наставничество, консерватизм.',
      descriptionTwo:
        'Перевернуто: нерелигиозность, отсутствие моральных принципов, дезорганизация, недостаток авторитета, индивидуализм.',
    },
    {
      name: 'Влюблённые',
      image: 'https://feathertail.ru/images/tarot/elder/lovers.jpg',
      description:
        'Прямо: любовь, страсть, привязанность, гармония, выбор, взаимность.',
      descriptionTwo:
        'Перевернуто: разрыв, неразрешенность, несоответствие, неприятие, нежелание делать выбор.',
    },
    {
      name: 'Колесница',
      image: 'https://feathertail.ru/images/tarot/elder/chariot.jpg',
      description:
        'Прямо: движение, преодоление препятствий, достижение цели, сила воли, самодисциплина, уверенность в себе.',
      descriptionTwo:
        ' Перевёрнуто: неудача, сбой в планах, препятствия на пути, неуверенность, отсутствие самоконтроля, смятение, конфликт, борьба, потеря контроля над ситуацией.',
    },
    {
      name: 'Сила',
      image: 'https://feathertail.ru/images/tarot/elder/strength.jpg',
      description:
        'Прямо: смелость, мужество, внутренняя сила, контроль над животными инстинктами, жертвенность, благородство, доброта, любовь.',
      descriptionTwo:
        ' Перевёрнуто: неуверенность, страх, отсутствие силы воли, неумение контролировать свои эмоции и инстинкты, жестокость, эгоизм, насилие, унижение.',
    },
    {
      name: 'Отшельник',
      image: 'https://feathertail.ru/images/tarot/elder/hermit.jpg',
      description:
        'Прямо: саморазвитие, обучение, размышление, интуиция, мудрость, поиск, одиночество, внутреннее путешествие.',
      descriptionTwo:
        'Перевернуто: замкнутость, отчуждение, отказ от обучения, заблуждения, одиночество, слишком большое уединение.',
    },
    {
      name: 'Колесо Фортуны',
      image: 'https://feathertail.ru/images/tarot/elder/wheel-of-fortune.jpg',
      description:
        'Прямо: удача, изменения, эволюция, судьба, карма, влияние высших сил.',
      descriptionTwo:
        'Перевернуто: неожиданные изменения, несправедливость, непостоянство, цикличность неудач и препятствий, отсутствие контроля над жизнью.',
    },
    {
      name: 'Справедливость',
      image: 'https://feathertail.ru/images/tarot/elder/justice.jpg',
      description:
        'Прямо: справедливость, баланс, порядок, объективность, закон, правда, честность.',
      descriptionTwo:
        'Перевернуто: несправедливость, дисбаланс, хаос, необъективность, нарушение закона, ложь, нечестность.',
    },
    {
      name: 'Повешенный',
      image: 'https://feathertail.ru/images/tarot/elder/hanged-man.jpg',
      description:
        'Прямо: жертва, самопожертвование, новый взгляд, духовное прозрение, восприятие реальности.',
      descriptionTwo:
        'Перевернуто: эгоизм, отсутствие самопожертвования, мучительное ожидание, невосприимчивость к духовному росту, стагнация.',
    },
    {
      name: 'Смерть',
      image: 'https://feathertail.ru/images/tarot/elder/death.jpg',
      description:
        'Прямо: окончание, переход, преобразование, новое начало, рождение, обновление, изменение.',
      descriptionTwo:
        'Перевернуто: стагнация, отказ от перемен, невозможность движения вперед, страх перед переменами, упадок, разложение.',
    },
    {
      name: 'Солнце',
      image: 'https://feathertail.ru/images/tarot/elder/sun.jpg',
      description:
        'Прямо: радость, благополучие, оптимизм, успех, достижение цели, удача, свет, жизнь, новое начало.',
      descriptionTwo:
        'Перевернуто: временные трудности, неудача, затруднения, невыполнение планов, потеря цели, затмение.',
    },
    {
      name: 'Луна',
      image: 'https://feathertail.ru/images/tarot/elder/moon.jpg',
      description:
        'Прямо: интуиция, подсознание, неясность, фантазии, неопределенность, мистика.',
      descriptionTwo:
        'Перевернуто: страхи, иллюзии, неуверенность, сумбурность, тайное, несбыточное.',
    },
    {
      name: 'Звезда',
      image: 'https://feathertail.ru/images/tarot/elder/star.jpg',
      description:
        'Прямо: надежда, вера, воображение, духовность, интуиция, творческий потенциал. ',
      descriptionTwo:
        'Перевернуто: потеря веры, отсутствие воображения, отсутствие духовности, безнадёжность.',
    },
    {
      name: 'Башня',
      image: 'https://feathertail.ru/images/tarot/elder/tower.jpg',
      description:
        'Прямо: крушение, разрушение, катастрофа, потеря, ошибка, иллюзии.',
      descriptionTwo:
        'Перевернуто: избежание катастрофы, предотвращение потерь, переоценка целей, понимание реальности.',
    },
    {
      name: 'Дьявол',
      image: 'https://feathertail.ru/images/tarot/elder/devil.jpg',
      description:
        'Прямо: материальная привязанность, эгоизм, низменные инстинкты, страсть, искушение, жадность, зависимость.',
      descriptionTwo:
        'Перевернуто: освобождение от материальных оков, осознание своих страхов и недостатков, преодоление зависимостей, духовное просветление.',
    },
    {
      name: 'Умеренность',
      image: 'https://feathertail.ru/images/tarot/elder/temperance.jpg',
      description:
        'Прямо: гармония, баланс, смирение, умеренность, взаимодействие, мир.',
      descriptionTwo:
        'Перевернуто: дисбаланс, несмирение, неумеренность, неправильное взаимодействие, конфликт, беспокойство.',
    },
    {
      name: 'Страшный суд',
      image: 'https://feathertail.ru/images/tarot/elder/judgement.jpg',
      description:
        'Прямо: вознаграждение, обновление, освобождение, рождение нового, карма, судьба.',
      descriptionTwo:
        'Перевернуто: наказание, неприятности, сокрытие, отрицание, избегание ответственности.',
    },
    {
      name: 'Мир',
      image: 'https://feathertail.ru/images/tarot/elder/world.jpg',
      description:
        'Прямо: Идеал, благополучие, достижение целей, гармония, окончание пути, мир.',
      descriptionTwo:
        'Перевернуто: дисбаланс, несмирение, неумеренность, неправильное взаимодействие, конфликт, беспокойство.',
    },
    {
      name: 'Туз пентаклей',
      image: 'https://feathertail.ru/images/tarot/pentacles/ace.jpeg',
      description:
        'Прямо: благосостояние, процветание, материальный успех, финансовая стабильность, практические навыки, реализация идей.',
      descriptionTwo:
        'Перевернуто: финансовые потери, материальные неудачи, непрактичность, нереализованные идеи, нестабильность в делах, нерешительность.',
    },
    {
      name: 'Двойка пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/two.jpg',
      description:
        'Прямо: гибкость, адаптация, баланс, умение многозадачить, финансовые решения.',
      descriptionTwo:
        'Перевернуто: нестабильность, невозможность справиться с несколькими задачами, финансовые проблемы, нерешительность в принятии решений.',
    },
    {
      name: 'Тройка пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/three.jpg',
      description:
        'Прямо: умение работать в команде, практические навыки, материальное благополучие, рост и развитие, трудолюбие.',
      descriptionTwo:
        'Перевернуто: неэффективность в работе, потери в финансовом плане, недостаток практических навыков, отсутствие роста и развития, ленивое отношение к работе.',
    },
    {
      name: 'Четвёрка пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/four.jpg',
      description:
        'Прямо: материальная обеспеченность, безопасность, благополучие, устойчивость, реализация целей.',
      descriptionTwo:
        'Перевернуто: жадность, скупость, страх потери, неспособность отпустить, финансовые проблемы.',
    },
    {
      name: 'Пятёрка пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/five.jpg',
      description:
        'Прямо: материальная нищета, финансовые трудности, беспокойство, потеря безопасности, испытание веры.',
      descriptionTwo:
        'Перевернуто: преодоление трудностей, новый заработок, обретение финансовой стабильности, преодоление испытаний. ',
    },
    {
      name: 'Шестёрка пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/six.jpg',
      description:
        'Прямо: щедрость, благотворительность, поддержка, сочувствие, благодарность, материальная стабильность.',
      descriptionTwo:
        'Перевернуто: жадность, эгоизм, ограничение, неблагодарность, неспособность принимать помощь, финансовые трудности.',
    },
    {
      name: 'Семёрка пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/seven.jpg',
      description:
        'Прямо: усердие, трудолюбие, настойчивость, сбор урожая, награда, устойчивость.',
      descriptionTwo:
        'Перевернуто: отсутствие настойчивости, недостаточное усердие, неполный урожай, невознаграждение, неустойчивость.',
    },
    {
      name: 'Восьмёрка пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/eight.jpg',
      description:
        'Прямо: мастерство, умение, качество, ремесло, трудолюбие, продуктивность, надежность.',
      descriptionTwo:
        ' Перевёрнуто: некачественная работа, невнимательность к деталям, непродуктивность, неэффективность, непостоянство, отсутствие усилий.',
    },
    {
      name: 'Девятка пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/nine.jpg',
      description:
        'Прямо: достижение, благополучие, удовлетворение, самодостаточность, материальная стабильность, талант.',
      descriptionTwo:
        ' Перевёрнуто: неудовлетворённость, неуверенность, материальные потери, потеря таланта, незавершённость.',
    },
    {
      name: 'Десятка пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/ten.jpg',
      description:
        'Прямо: богатство, семейное счастье, наследство, благополучие, традиции.',
      descriptionTwo:
        'Перевернуто: материальные потери, финансовые проблемы, жадность, обжорство, потеря духовности и ценностей, неудачи в бизнесе и инвестициях.',
    },
    {
      name: 'Паж пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/page.jpg',
      description:
        'Прямо: новые возможности, начало нового дела, земные интересы, финансы, практичность.',
      descriptionTwo:
        ' Перевёрнуто: неуверенность в своих возможностях, неэффективность, неорганизованность, финансовые трудности, пренебрежение материальными потребностями.',
    },
    {
      name: 'Рыцарь пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/knight.jpg',
      description:
        'Прямо: надежность, ответственность, трудолюбие, практичность, целеустремлённость.',
      descriptionTwo:
        'Перевернуто: зацикленность на материальных вещах, жадность, алчность, склонность к разочарованию в делах, связанных с богатством и достижением успеха.',
    },
    {
      name: 'Королева пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/queen.jpg',
      description:
        'Прямо: материальное благополучие, уверенность, трудолюбие, желание контроля, процветание, усердие.',
      descriptionTwo:
        'Перевернуто: неразумные финансовые решения, скупость, жадность, обманчивое богатство, нестабильность, непостоянство.',
    },
    {
      name: 'Король пенталкей',
      image: 'https://feathertail.ru/images/tarot/pentacles/king.jpg',
      description:
        'Прямо: процветание, стабильность, материальная безопасность, управление финансами, практичность, честность и щедрость.',
      descriptionTwo:
        'Перевернуто: жадность, эгоизм, скупость, ограниченность, нежелание делиться, неспособность управлять финансами.',
    },
    {
      name: 'Туз жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/ace.jpg',
      description:
        'Прямо: начало нового проекта, возможности для роста и развития, творческое вдохновение, мощная духовная энергия.',
      descriptionTwo:
        'Перевернуто: неудача в начинаниях, потеря вдохновения, препятствия на пути к росту и развитию.',
    },
    {
      name: 'Двойка жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/two.jpg',
      description:
        'Прямо: партнерство, сотрудничество, равновесие, гармония, взаимодействие, начало новых дел.',
      descriptionTwo:
        'Перевернуто: неравновесие, несовместимость, неудачное партнерство, неуверенность.',
    },
    {
      name: 'Тройка жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/three.jpg',
      description:
        'Прямо: рост, развитие, продвижение, достижения, творческая продуктивность.',
      descriptionTwo:
        'Перевернуто: задержка в развитии, конфликты, препятствия на пути к успеху.',
    },
    {
      name: 'Четвёрка жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/four.jpg',
      description:
        'Прямо: успех, достижение целей, уважение, признание, процветание.',
      descriptionTwo:
        'Перевернуто: ложное чувство удовлетворенности, сомнения в своих успехах, потеря уважения.',
    },
    {
      name: 'Пятёрка жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/five.jpg',
      description:
        'Прямо: испытание, потеря, борьба, но с возможностью для роста и улучшения ситуации.',
      descriptionTwo:
        'Перевернуто: бедность, нищета, отчаяние, потеря веры в себя и свои возможности.',
    },
    {
      name: 'Шестёрка жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/six.jpg',
      description:
        'Прямо: победа, достижение целей, уверенность, благополучие, уважение.',
      descriptionTwo:
        'Перевернуто: вынужденная победа, ложная уверенность, потеря уважения, неудача.',
    },
    {
      name: 'Семёрка жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/seven.jpg',
      description:
        'Прямо: продвижение, достижение новых высот, восхваление, признание.',
      descriptionTwo:
        'Перевернуто: неуверенность в своих способностях, сомнения в своих успехах, потеря признания.',
    },
    {
      name: 'Восьмёрка жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/eight.jpg',
      description:
        'Прямо: движение вперед, настойчивость, целеустремленность, долгосрочные планы, организация, лидерство.',
      descriptionTwo:
        'Перевернуто: затруднения в достижении целей, нерешительность, отсутствие плана действий, конфликт лидерства, негативное влияние на организацию.',
    },
    {
      name: 'Девятка жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/nine.jpg',
      description:
        'Прямо: продвижение, достижение, развитие, целеустремленность, энергия, духовное просвещение.',
      descriptionTwo:
        'Перевернуто: задержка, препятствия, недостаток энергии, отсутствие прогресса, неудачи, затруднения.',
    },
    {
      name: 'Десятка жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/ten.jpg',
      description:
        'Прямо: достижение цели, успех, выполнение задачи, удовлетворение, победа, уверенность.',
      descriptionTwo:
        'Перевернуто: неудача, задержка, препятствия, неспособность завершить задачу, потеря мотивации, разочарование.',
    },
    {
      name: 'Паж жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/page.jpg',
      description:
        'Прямо: новые начинания, возможности для роста и развития, энергия и мотивация, любопытство, коммуникация.',
      descriptionTwo:
        'Перевернуто: недостаток энергии и мотивации, неопределенность в планах на будущее, отсутствие новых возможностей, нерешительность и неуверенность.',
    },
    {
      name: 'Рыцарь жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/knight.jpg',
      description: 'Прямо: движение, прогресс, риск, авантюризм.',
      descriptionTwo:
        'Перевернуто: раздражительный, необдуманный, нестабильный, излишне амбициозный, нервный, конфликтный.',
    },
    {
      name: 'Королева жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/queen.jpg',
      description: 'Прямо: успех, строгость, справедливость, любовь к роскоши.',
      descriptionTwo: 'Перевернуто: ревность, обман, услуга, одолжение',
    },
    {
      name: 'Король жезлов',
      image: 'https://feathertail.ru/images/tarot/wands/king.jpg',
      description: 'Прямо: гордость, честолюбие, активность, быстрая реакция.',
      descriptionTwo:
        'Перевернуто: Вспыльчивость, строгость, нетерпимость, деспотизм.',
    },
    {
      name: 'Туз мечей',
      image: 'https://feathertail.ru/images/tarot/swords/ace.jpg',
      description:
        'Прямо: новое начало, чистый и ясный ум, возможности, новые идеи, творческий потенциал.',
      descriptionTwo:
        'Перевернуто: недостаток ясности, затруднения с принятием решений, невозможность действовать, потеря энергии, растерянность.',
    },
    {
      name: 'Двойка мечей',
      image: 'https://feathertail.ru/images/tarot/swords/two.jpg',
      description: 'Прямо: выбор, баланс, гармония, решение, дипломатия.',
      descriptionTwo:
        'Перевернуто: затруднения с выбором, необходимость сделать компромисс, потеря баланса, конфликты, неопределенность.',
    },
    {
      name: 'Тройка мечей',
      image: 'https://feathertail.ru/images/tarot/swords/three.jpg',
      description:
        'Прямо: разрушение, печаль, грусть, расставание, травма, разочарование, обман.',
      descriptionTwo:
        'Перевернуто: исцеление, преодоление травмы, принятие решений, смирение, нахождение нового смысла в жизни.',
    },
    {
      name: 'Четвёрка мечей',
      image: 'https://feathertail.ru/images/tarot/swords/four.jpg',
      description:
        'Прямо: уединение, покой, отдых, восстановление, внутренний мир.',
      descriptionTwo:
        'Перевернуто: избегание реальности, замкнутость, слишком много времени, проведенного в одиночестве, депрессия.',
    },
    {
      name: 'Пятёрка мечей',
      image: 'https://feathertail.ru/images/tarot/swords/five.jpg',
      description:
        'Прямо: потеря, разочарование, предательство, поражение, конец, утрата.',
      descriptionTwo:
        'Перевернуто: начало исцеления, нахождение нового смысла в жизни, принятие потерь, переоценка ценностей.',
    },
    {
      name: 'Шестёрка мечей',
      image: 'https://feathertail.ru/images/tarot/swords/six.jpg',
      description:
        'Прямо: потеря, разочарование, предательство, поражение, конец, утрата.',
      descriptionTwo:
        'Перевернуто: начало исцеления, нахождение нового смысла в жизни, принятие потерь, переоценка ценностей.',
    },
    {
      name: 'Семёрка мечей',
      image: 'https://feathertail.ru/images/tarot/swords/seven.jpg',
      description:
        'Прямо: уход, секреты, уклонение, побег, предательство, страх.',
      descriptionTwo:
        'Перевернуто: столкновение с проблемой, необходимость принимать решения, раскрытие тайн, разрешение конфликта.',
    },
    {
      name: 'Восьмёрка мечей',
      image: 'https://feathertail.ru/images/tarot/swords/eight.jpg',
      description:
        'Прямо: двоемыслие, притворство, скрытность, неопределенность, замешательство, опасность.',
      descriptionTwo:
        'Перевернуто: прозрение, истина, обнажение, раскрытие, ясность, решительность.',
    },
    {
      name: 'Девятка мечей',
      image: 'https://feathertail.ru/images/tarot/swords/nine.jpg',
      description:
        'Прямо: болезнь, травма, изоляция, одиночество, грусть, потеря, печаль.',
      descriptionTwo:
        'Перевернуто: излечение, восстановление здоровья, выход из изоляции, преодоление грусти и потерь, новый виток жизни.',
    },
    {
      name: 'Десятка мечей',
      image: 'https://feathertail.ru/images/tarot/swords/ten.jpg',
      description:
        'Прямо: окончание круга, конец проекта, разрешение, освобождение, новое начало, осознание результата, освобождение от бремени.',
      descriptionTwo:
        'Перевернуто: затяжной конец, отсрочка, неизбежность неудачи, потеря, иллюзии, страхи, препятствия.',
    },
    {
      name: 'Паж мечей',
      image: 'https://feathertail.ru/images/tarot/swords/page.jpg',
      description:
        'Прямо: новые идеи, обучение, ум, активность, стремление к знаниям, наблюдательность.',
      descriptionTwo:
        'Перевернуто: недостаток опыта, глупость, неактивность, нерешительность, недостаточная наблюдательность, невнимательность.',
    },
    {
      name: 'Рыцарь мечей',
      image: 'https://feathertail.ru/images/tarot/swords/knight.jpg',
      description:
        'Прямо: амбициозность, целеустремленность, решительность, честность, готовность к действию, отвага.',
      descriptionTwo:
        'Перевернуто: необдуманность, стремление к действию без планирования, жестокость, безжалостность, эгоизм, конфликты.',
    },
    {
      name: 'Королева мечей',
      image: 'https://feathertail.ru/images/tarot/swords/queen.jpg',
      description:
        'Прямо: независимость, ум, логика, организованность, остроумие, необходимость принимать решения.',
      descriptionTwo:
        'Перевернуто: эмоциональная нестабильность, критичность, холодность, жесткость, манипулятивность, коварство.',
    },
    {
      name: 'Король мечей',
      image: 'https://feathertail.ru/images/tarot/swords/king.jpg',
      description:
        'Прямо: логика, отвага, справедливость, рациональность, авторитет, решительность.',
      descriptionTwo:
        'Перевернуто: эгоизм, злобность, недостаток рациональности, несправедливость, авторитарность, жестокость.',
    },
    {
      name: 'Туз кубков',
      image: 'https://feathertail.ru/images/tarot/cups/ace.jpg',
      description:
        'Прямо: новое начало в чувствах, любовь, счастье, гармония, мир.',
      descriptionTwo:
        'Перевернуто: потеря радости, разочарование, проблемы в отношениях, эмоциональное неравновесие.',
    },
    {
      name: 'Двойка кубков',
      image: 'https://feathertail.ru/images/tarot/cups/two.jpg',
      description:
        'Прямо: радость, взаимопонимание, духовность, гармония, равенство, любовь.',
      descriptionTwo:
        'Перевернуто: разногласия, конфликты, нарушение равновесия, непонимание.',
    },
    {
      name: 'Тройка кубков',
      image: 'https://feathertail.ru/images/tarot/cups/three.jpg',
      description:
        'Прямо: творчество, общение, сближение, романтика, мечты, чувственность.',
      descriptionTwo:
        'Перевернуто: нарушение гармонии, нереальные ожидания, обман, разочарование.',
    },
    {
      name: 'Четвёрка кубков',
      image: 'https://feathertail.ru/images/tarot/cups/four.jpg',
      description:
        'Прямо: удовлетворение, уют, семейное счастье, душевная гармония, благополучие.',
      descriptionTwo:
        'Перевернуто: неудовлетворенность, чувство потери, невозможность добиться желаемого.',
    },
    {
      name: 'Пятёрка кубков',
      image: 'https://feathertail.ru/images/tarot/cups/five.jpg',
      description:
        'Прямо: потеря, горе, печаль, изменения, прощание, рефлексия.',
      descriptionTwo:
        'Перевернуто: обреченность, отчаяние, невозможность принять изменения, негативные эмоции.',
    },
    {
      name: 'Шестёрка кубков',
      image: 'https://feathertail.ru/images/tarot/cups/six.jpg',
      description:
        'Прямо: детские радости, душевное счастье, воспоминания, ностальгия, довольство жизнью.',
      descriptionTwo:
        'Перевернуто: потеря ностальгических воспоминаний, невозможность довольствоваться жизнью, нарушение равновесия.',
    },
    {
      name: 'Семёрка кубков',
      image: 'https://feathertail.ru/images/tarot/cups/seven.jpg',
      description:
        'Прямо: исследование чувственного мира, воображение, мечты, тайна, загадки.',
      descriptionTwo:
        'Перевернуто: обман, нереальность мечтаний, негативное мышление.',
    },
    {
      name: 'Восьмёрка кубков',
      image: 'https://feathertail.ru/images/tarot/cups/eight.jpg',
      description:
        'Прямо: благодарность, удовлетворение, исполнение желаний, душевный комфорт, наслаждение жизнью.',
      descriptionTwo:
        'Перевернуто: невозможность получить удовлетворение, невыполнение желаний, чувство потери.',
    },
    {
      name: 'Девятка кубков',
      image: 'https://feathertail.ru/images/tarot/cups/nine.jpg',
      description:
        'Прямо: благополучие, удовлетворение, радость, исполнение желаний, любовь, общность.',
      descriptionTwo:
        'Перевернуто: неудовлетворенность, разочарование, потеря радости, неисполнение желаний, недоверие, неудача.',
    },
    {
      name: 'Десятка кубков',
      image: 'https://feathertail.ru/images/tarot/cups/ten.jpg',
      description:
        'Прямо: счастье, любовь, радость, гармония в отношениях, благополучная жизнь в обществе с любимыми людьми.',
      descriptionTwo:
        'Перевёрнуто: неудовлетворенность, несчастье, неисполнение желаний, разочарование, потеря радости, недостаток любви.',
    },
    {
      name: 'Паж кубков',
      image: 'https://feathertail.ru/images/tarot/cups/page.jpg',
      description:
        'Прямо: юношеская наивность, креативность, воображение и потенциал, внутренний ребенок, творчество.',
      descriptionTwo:
        'Перевёрнуто: неудачи в творческих начинаниях, препятствия в достижении целей, эмоциональное расстройство, негативные чувства, проблемы в личных отношениях.',
    },
    {
      name: 'Рыцарь кубков',
      image: 'https://feathertail.ru/images/tarot/cups/knight.jpg',
      description:
        'Прямо: мечтательность, эмоциональность и эстетичность, новые любовные отношения и творчество.',
      descriptionTwo:
        'Перевернуто: нерешительность, неуверенность, отсутствие преданности, боязнь риска, пренебрежение безопасностью.',
    },
    {
      name: 'Королева кубков',
      image: 'https://feathertail.ru/images/tarot/cups/queen.jpg',
      description:
        'Прямо: интуиция, чуткость, мудрость, чувство любви и сострадания, эмоциональная и духовная связь, поддержка и вдохновение.',
      descriptionTwo:
        'Перевернуто: эмоциональная нестабильность, неприятие чувств, непостоянство, обман в чувствах, разрыв связи.',
    },
    {
      name: 'Король кубков',
      image: 'https://feathertail.ru/images/tarot/cups/king.jpg',
      description:
        'Прямо: эмоциональная зрелость, мудрость, стабильность и гармония, преодоление эмоциональных трудностей и обретение гармонии в любви, творчестве и духовности.',
      descriptionTwo:
        'Перевернуто: злоупотребление властью, тирания, чрезмерный контроль, отсутствие долга и ответственности, нестабильность, недостаток уверенности в себе.',
    },
  ];

  let drawnCards = [];
  const STORAGE_KEY = 'ksTarotStateV1';
  let tooltipDocumentHandlerAttached = false;

  const spreads = {
    free: {
      key: 'free',
      label: 'Свободный расклад',
      description:
        'Вы тянете карты одну за другой, пока не решите остановиться или не закончится колода.',
      type: 'free',
    },
    one: {
      key: 'one',
      label: 'Одна карта (совет дня)',
      description: 'Одна карта даёт общий совет.',
      type: 'fixed',
      cards: 1,
      positions: ['Совет карты'],
    },
    three: {
      key: 'three',
      label: 'Прошлое — Настоящее — Будущее',
      description:
        'Классический расклад на три карты: что было, что есть и к чему всё идёт.',
      type: 'fixed',
      cards: 3,
      positions: ['Прошлое', 'Настоящее', 'Будущее'],
    },
    relationship: {
      key: 'relationship',
      label: 'Отношения',
      description:
        'Три карты: ты, другой человек и вероятный исход ваших отношений.',
      type: 'fixed',
      cards: 3,
      positions: ['Ты', 'Партнёр / ситуация', 'Исход'],
    },
    choice: {
      key: 'choice',
      label: 'Выбор',
      description:
        'Помогает определиться между двумя вариантами и показывает совет Таро.',
      type: 'fixed',
      cards: 3,
      positions: ['Вариант A', 'Вариант B', 'Совет'],
    },
  };

  const spreadSelect = document.querySelector('#tarot-spread-select');
  const spreadDescriptionEl = document.querySelector(
    '#tarot-spread-description',
  );

  const drawButton = document.querySelector('#tarot-draw-btn');
  const drawButtonText = document.querySelector('#tarot-draw-btn-text');
  const resetButton = document.querySelector('#tarot-reset-btn');

  const deckCountEl = document.querySelector('#tarot-deck-count');
  const outOfCardsEl = document.querySelector('#tarot-out-of-cards');

  const currentContainer = document.querySelector('#tarot-current-spread');
  const historyList = document.querySelector('#tarot-drawn-cards');
  const historySection = document.querySelector('.ks-tarot__history');
  const historyTitle = historySection?.querySelector('.ks-tarot__block-title');

  if (!spreadSelect || !drawButton || !currentContainer) return;

  function updateDeckCount() {
    if (deckCountEl) {
      deckCountEl.textContent = String(deck.length);
    }
    refreshDrawButtonState();
  }

  function saveState() {
    try {
      const spreadKey = spreadSelect ? spreadSelect.value : 'free';
      const state = {
        deck,
        drawnCards,
        spreadKey,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Tarot: saveState error', e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (
        !state ||
        !Array.isArray(state.deck) ||
        !Array.isArray(state.drawnCards)
      )
        return;

      deck.length = 0;
      deck.push(...state.deck);

      drawnCards = state.drawnCards;

      if (state.spreadKey && spreads[state.spreadKey] && spreadSelect) {
        spreadSelect.value = state.spreadKey;
      }
    } catch (e) {
      console.error('Tarot: loadState error', e);
    }
  }

  function setOutOfCardsVisible(visible) {
    if (!outOfCardsEl) return;

    outOfCardsEl.classList.toggle('ks-tarot__status--visible', visible);

    if (visible) {
      if (drawButton) drawButton.disabled = true;
    } else {
      refreshDrawButtonState();
    }
  }

  function getCurrentSpread() {
    const key = spreadSelect.value || 'free';
    return spreads[key] || spreads.free;
  }

  function getCurrentSpread() {
    const key = spreadSelect.value || 'free';
    return spreads[key] || spreads.free;
  }

  function refreshDrawButtonState() {
    if (!drawButton) return;

    const spread = getCurrentSpread();
    const notEnoughCards =
      !deck.length || (spread.type === 'fixed' && deck.length < spread.cards);

    drawButton.disabled = notEnoughCards;
  }

  function updateSpreadUI() {
    const spread = getCurrentSpread();

    if (spreadDescriptionEl) {
      spreadDescriptionEl.textContent = spread.description;
    }
    if (drawButtonText) {
      drawButtonText.textContent =
        spread.type === 'free' ? 'Тянуть карту' : 'Сделать расклад';
    }

    refreshDrawButtonState();
    saveState();
  }

  function drawOneCard(spreadKey, positionLabel, spreadTitle) {
    if (!deck.length) return null;

    const randomIndex = Math.floor(Math.random() * deck.length);
    const card = deck.splice(randomIndex, 1)[0];

    card.flipImage = Math.random() < 0.5;
    card.spreadKey = spreadKey;
    card.positionLabel = positionLabel || '';
    card.spreadTitle = spreadTitle || '';

    drawnCards.push(card);

    updateDeckCount();
    if (!deck.length) setOutOfCardsVisible(true);

    return card;
  }

  function renderCurrentSpread(cards) {
    currentContainer.innerHTML = '';

    if (!cards || !cards.length) {
      const p = document.createElement('p');
      p.className = 'ks-tarot__placeholder';
      p.textContent = 'Нажмите «Тянуть карту», чтобы начать гадание.';
      currentContainer.appendChild(p);
      return;
    }

    const row = document.createElement('div');
    row.className = 'ks-tarot__cards-row';

    cards.forEach((card, index) => {
      const article = document.createElement('article');
      article.className = 'ks-tarot-card ks-tarot-card--enter';
      article.style.animationDelay = `${index * 90}ms`;

      if (card.flipImage) {
        article.classList.add('ks-tarot-card--reversed');
      }

      const meaning = card.flipImage ? card.descriptionTwo : card.description;

      article.innerHTML = `
        <div class="ks-tarot-card__img-wrap">
          <img src="${card.image}" alt="${card.name}">
        </div>
        <div class="ks-tarot-card__body">
          ${
            card.positionLabel
              ? `<div class="ks-tarot-card__position">${card.positionLabel}</div>`
              : ''
          }
          <h4 class="ks-tarot-card__name">${card.name}</h4>
          <div class="ks-tarot-card__tooltip">
            <button class="ks-tarot-card__tooltip-btn" type="button">
              <i class="fa-regular fa-circle-question" aria-hidden="true"></i>
              <span>Толкование</span>
            </button>
            <div class="ks-tarot-tooltip">
              <p class="ks-tarot-tooltip__text">${meaning}</p>
            </div>
          </div>
        </div>
      `;

      row.appendChild(article);
    });

    currentContainer.appendChild(row);
    initTooltips();
  }

  function initTooltips() {
    const tooltipBlocks = currentContainer.querySelectorAll(
      '.ks-tarot-card__tooltip',
    );
    if (!tooltipBlocks.length) return;

    const closeAll = () => {
      currentContainer
        .querySelectorAll('.ks-tarot-tooltip--visible')
        .forEach((el) => el.classList.remove('ks-tarot-tooltip--visible'));
    };

    tooltipBlocks.forEach((wrap) => {
      const btn = wrap.querySelector('.ks-tarot-card__tooltip-btn');
      const tooltip = wrap.querySelector('.ks-tarot-tooltip');
      if (!btn || !tooltip) return;

      btn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        const isOpen = tooltip.classList.contains('ks-tarot-tooltip--visible');
        closeAll();
        if (!isOpen) {
          tooltip.classList.add('ks-tarot-tooltip--visible');
        }
      });
    });

    if (!tooltipDocumentHandlerAttached) {
      document.addEventListener('click', (evt) => {
        if (!currentContainer.contains(evt.target)) {
          closeAll();
        }
      });
      tooltipDocumentHandlerAttached = true;
    }
  }

  function renderHistory() {
    historyList.innerHTML = '';

    if (!drawnCards.length) {
      const empty = document.createElement('li');
      empty.className = 'ks-tarot__list-empty';
      empty.textContent =
        'Пока карт нет. Сначала сделайте расклад или вытяните карту.';
      historyList.appendChild(empty);
      return;
    }

    drawnCards.forEach((card, index) => {
      const li = document.createElement('li');
      li.className = 'ks-tarot__list-item';

      li.innerHTML = `
        <article class="ks-tarot-card-mini ${
          card.flipImage ? 'ks-tarot-card-mini--reversed' : ''
        }" data-index="${index}">
          <div class="ks-tarot-card-mini__index">#${index + 1}</div>
          <div class="ks-tarot-card-mini__img-wrap">
            <img src="${card.image}" alt="${card.name}">
          </div>
          <div class="ks-tarot-card-mini__body">
            <h4 class="ks-tarot-card-mini__name">${card.name}</h4>
            <p class="ks-tarot-card-mini__text">
              ${card.flipImage ? card.descriptionTwo : card.description}
            </p>
          </div>
        </article>
      `;

      historyList.appendChild(li);
    });

    const lastArticle = historyList.querySelector(
      '.ks-tarot-card-mini:last-child',
    );
    if (lastArticle) {
      historyList
        .querySelectorAll('.ks-tarot-card-mini--active')
        .forEach((el) => el.classList.remove('ks-tarot-card-mini--active'));
      lastArticle.classList.add('ks-tarot-card-mini--active');
    }

    historyList.scrollTop = historyList.scrollHeight;
  }

  function handleDrawClick() {
    const spread = getCurrentSpread();

    const notEnoughCards =
      !deck.length || (spread.type === 'fixed' && deck.length < spread.cards);

    if (notEnoughCards) {
      setOutOfCardsVisible(true);
      return;
    }

    setOutOfCardsVisible(false);

    const currentBlock = document.querySelector('.ks-tarot__block--current');
    if (currentBlock) {
      currentBlock.classList.remove('ks-tarot__block--shuffle');
      void currentBlock.offsetWidth;
      currentBlock.classList.add('ks-tarot__block--shuffle');
    }

    if (spread.type === 'free') {
      const card = drawOneCard(spread.key, '', spread.label);
      if (!card) return;
      renderCurrentSpread([card]);
    } else {
      const cards = [];
      for (let i = 0; i < spread.cards; i += 1) {
        const positionLabel = spread.positions?.[i] || '';
        const card = drawOneCard(spread.key, positionLabel, spread.label);
        if (!card) break;
        cards.push(card);
      }
      renderCurrentSpread(cards);
    }

    renderHistory();
    saveState();
  }

  function getLastSpreadCards() {
    if (!drawnCards.length) return [];

    const last = drawnCards[drawnCards.length - 1];

    if (!last.spreadKey || !spreads[last.spreadKey]) {
      return [last];
    }

    const spread = spreads[last.spreadKey];

    if (spread.type !== 'fixed') {
      return [last];
    }

    const result = [];
    for (let i = drawnCards.length - 1; i >= 0; i -= 1) {
      const card = drawnCards[i];
      if (card.spreadKey !== last.spreadKey) break;
      result.push(card);
      if (result.length === spread.cards) break;
    }

    return result.reverse();
  }

  function handleHistoryClick(evt) {
    const target = evt.target;
    if (!(target instanceof Element)) return;

    const article = target.closest('.ks-tarot-card-mini');
    if (!article || !historyList.contains(article)) return;

    const index = Number(article.dataset.index);
    const card = drawnCards[index];
    if (!card) return;

    renderCurrentSpread([card]);

    historyList
      .querySelectorAll('.ks-tarot-card-mini--active')
      .forEach((el) => el.classList.remove('ks-tarot-card-mini--active'));

    article.classList.add('ks-tarot-card-mini--active');
  }

  function handleResetClick() {
    if (drawnCards.length) {
      deck.push(...drawnCards);
      drawnCards = [];
    }

    updateDeckCount();
    setOutOfCardsVisible(false);
    renderCurrentSpread([]);
    renderHistory();
    saveState();
  }

  loadState();
  updateSpreadUI();
  updateDeckCount();
  renderCurrentSpread(getLastSpreadCards());
  renderHistory();
  setOutOfCardsVisible(deck.length === 0);

  spreadSelect.addEventListener('change', updateSpreadUI);
  drawButton.addEventListener('click', handleDrawClick);
  resetButton.addEventListener('click', handleResetClick);
  historyList.addEventListener('click', handleHistoryClick);

  if (historySection && historyTitle) {
    historyTitle.addEventListener('click', () => {
      historySection.classList.toggle('ks-tarot__history--collapsed');
    });
  }
})();
