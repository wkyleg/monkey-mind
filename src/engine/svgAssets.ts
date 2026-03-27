/**
 * SVG Asset loading and rendering system
 */

export interface SvgAsset {
  id: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  loaded: boolean;
}

export interface SvgRenderOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  alpha?: number;
  tint?: string;
  glow?: number;
  glowColor?: string;
}

/**
 * SVG Asset Manager
 * Preloads SVG files and caches them as Image elements for Canvas rendering
 */
class SvgAssetManager {
  private assets: Map<string, SvgAsset> = new Map();
  private loadPromises: Map<string, Promise<SvgAsset>> = new Map();
  private basePath: string = `${import.meta.env.BASE_URL ?? '/'}assets/svg`;

  /**
   * Preload all game SVG assets
   */
  async preloadAll(): Promise<void> {
    const manifest: Record<string, string[]> = {
      // Core player assets
      player: ['monkey_default', 'monkey_calm', 'monkey_passion'],
      projectiles: ['banana', 'banana_explosive', 'beam'],

      // Legacy tier-based enemies (for backwards compatibility)
      'enemies/tier1': ['synapse_drone', 'neuron_cluster', 'pulse_node'],
      'enemies/tier2': ['glitch_sprite', 'orbital_eye', 'jellyfish_thought'],
      'enemies/tier3': ['logic_cultist', 'protocol_enforcer', 'animal_philosopher'],
      'enemies/tier4': ['tentacled_halo', 'fractal_insect', 'cyborg_dolphin'],
      'enemies/tier5': ['machine_elf', 'impossible_shape', 'ego_fragment'],

      // All bosses
      bosses: [
        'cortex_auditor',
        'grey_administrator',
        'banana_pentagon',
        'archon_exe',
        'mirror_self',
        'the_handler',
        'leviathan_of_attention',
        'cyclopean_gate',
        'seven_seals',
        'arcimboldo_crown',
        'minotaur_of_interpretation',
        'paradox_engine',
        'quiet_mind',
      ],

      // Powerups and UI
      powerups: ['calm_shield', 'calm_beam', 'passion_fury', 'passion_explosive'],
      ui: ['heart', 'logo'],

      // Act 1: Escape - Clinical lab theme (bosses loaded from main bosses/ folder)
      'acts/act1_escape/bg': [
        'act1_bg_grid',
        'act1_bg_bars',
        'act1_bg_warning',
        // Level-specific backgrounds
        'level1_cage',
        'level1_door',
        'level1_monitor',
        'level2_corridor',
        'level2_doors',
        'level2_alarm',
        'level3_bunker',
        'level3_isolation',
        'level3_thoughts',
        'level4_trial',
        'level4_accusation',
        'level4_flames',
        'level5_mind',
        'level5_chaos',
        'level5_eye',
      ],
      'acts/act1_escape/enemies': ['bureaucrat_drone', 'lab_chaser', 'swarm_cell'],
      // Level-specific enemies for Act 1
      'acts/act1_escape/level1_enemies': ['zookeeper', 'cage_drone', 'specimen_tag'],
      'acts/act1_escape/level2_enemies': ['pursuer', 'alarm_sensor', 'wrong_accusation'],
      'acts/act1_escape/level3_enemies': ['isolation_thought', 'pipe_crawler', 'echo_shadow'],
      'acts/act1_escape/level4_enemies': ['accuser', 'pyre_flame', 'hysteria'],

      // Act 2: Ocean - Deep sea theme
      'acts/act2_ocean/bg': [
        'act2_bg_abyss',
        'act2_bg_kelp',
        'act2_bg_bubbles',
        'level1_abyss',
        'level1_particles',
        'level1_biolum',
        'level2_reef',
        'level2_coral',
        'level2_fish',
        'level3_fungal',
        'level3_spores',
        'level3_glow',
        'level4_atlantis',
        'level4_ruins',
        'level4_dome',
      ],
      'acts/act2_ocean/enemies': ['depth_drifter', 'angler_chaser', 'pearl_courier', 'echo_swarm'],
      'acts/act2_ocean/level1_enemies': ['echo_fish', 'pressure_shadow', 'sonar_pulse'],
      'acts/act2_ocean/level2_enemies': ['angler_hunter', 'biolume_wisp', 'vent_crawler'],
      'acts/act2_ocean/level3_enemies': ['spore_mother', 'fungal_tendril', 'cordyceps_zombie'],
      'acts/act2_ocean/level4_enemies': ['atlantean_guard', 'trident_bearer', 'orichalcum_golem'],

      // Act 3: Heroic - Greek mythology theme
      'acts/act3_heroic/bg': [
        'act3_bg_columns',
        'act3_bg_stars',
        'act3_bg_laurel',
        'level1_stars',
        'level1_tree',
        'level1_names',
        'level2_sea',
        'level2_ships',
        'level2_sirens',
        'level3_mountains',
        'level3_army',
        'level3_shields',
        'level4_underworld',
        'level4_river',
        'level4_shades',
      ],
      'acts/act3_heroic/enemies': ['bronze_hoplite', 'harpy_swarm', 'fate_spinner', 'oracle_eye'],
      'acts/act3_heroic/level1_enemies': ['titan_elder', 'divine_offspring', 'chaos_spawn'],
      'acts/act3_heroic/level2_enemies': ['siren_singer', 'scylla_head', 'charybdis_pull'],
      'acts/act3_heroic/level3_enemies': ['persian_immortal', 'war_elephant', 'arrow_storm'],
      'acts/act3_heroic/level4_enemies': ['wandering_shade', 'cerberus_tooth', 'ferryman'],

      // Act 4: Sacred - Religious/spiritual theme
      'acts/act4_sacred/bg': [
        'act4_bg_mandala',
        'act4_bg_stained_glass',
        'act4_bg_incense',
        'level1_battlefield',
        'level1_chariots',
        'level1_divine',
        'level2_himalayas',
        'level2_monastery',
        'level2_prayer',
        'level3_market',
        'level3_lamps',
        'level3_smoke',
        'level4_cathedral',
        'level4_glass',
        'level4_organ',
      ],
      'acts/act4_sacred/enemies': ['dharma_wheel', 'prayer_swarm', 'incense_anchor', 'lotus_phaser'],
      'acts/act4_sacred/level1_enemies': ['kaurava_warrior', 'karma_spirit', 'maya_illusion'],
      'acts/act4_sacred/level2_enemies': ['tulpa_thought', 'mandala_spinner', 'singing_bowl'],
      'acts/act4_sacred/level3_enemies': ['ifrit_merchant', 'djinn_bottle', 'lamp_spirit'],
      'acts/act4_sacred/level4_enemies': ['gregorian_voice', 'incense_cloud', 'choir_fragment'],

      // Act 5: Painted - Art gallery theme
      'acts/act5_painted/bg': [
        'act5_bg_canvas',
        'act5_bg_brushstrokes',
        'act5_bg_surreal',
        'level1_garden',
        'level1_creatures',
        'level1_fruit',
        'level2_night',
        'level2_sky',
        'level2_stars',
        'level3_desert',
        'level3_clocks',
        'level3_elephants',
        'level4_theater',
        'level4_spotlights',
        'level4_audience',
      ],
      'acts/act5_painted/enemies': ['fruit_drifter', 'paint_splatter', 'brush_weaver', 'portrait_mimic'],
      'acts/act5_painted/level1_enemies': ['fruit_demon', 'bird_headed_sinner', 'egg_walker'],
      'acts/act5_painted/level2_enemies': ['saturn_fragment', 'night_sky_tear', 'celestial_body'],
      'acts/act5_painted/level3_enemies': ['melting_clock', 'elephant_leg', 'desert_ant'],
      'acts/act5_painted/level4_enemies': ['fragmented_face', 'spotlight_eye', 'audience_member'],

      // Act 6: Library - Philosophical theme
      'acts/act6_library/bg': [
        'act6_bg_bookshelves',
        'act6_bg_paradox',
        'act6_bg_manuscript',
        'level1_cave',
        'level1_fire',
        'level1_shadows',
        'level2_library',
        'level2_hexagons',
        'level2_books',
        'level3_office',
        'level3_desks',
        'level3_papers',
        'level4_mall',
        'level4_signs',
        'level4_crowds',
      ],
      'acts/act6_library/enemies': ['index_card', 'footnote_swarm', 'paradox_splitter', 'cipher_shield'],
      'acts/act6_library/level1_enemies': ['cave_shadow', 'fire_keeper', 'chained_prisoner'],
      'acts/act6_library/level2_enemies': ['book_specter', 'infinity_walker', 'catalog_worm'],
      'acts/act6_library/level3_enemies': ['form_processor', 'middle_manager', 'memo_spirit'],
      'acts/act6_library/level4_enemies': ['brand_ghost', 'shopping_zombie', 'discount_hunter'],

      // Act 7: Machine - Industrial theme
      'acts/act7_machine/bg': [
        'act7_bg_gears',
        'act7_bg_circuits',
        'act7_bg_pistons',
        'level1_theorem',
        'level1_symbols',
        'level1_paradox',
        'level2_desert',
        'level2_ants',
        'level2_patterns',
        'level3_mechanism',
        'level3_gears',
        'level3_bronze',
        'level4_timeline',
        'level4_arrows',
        'level4_loops',
      ],
      'acts/act7_machine/enemies': ['gear_drifter', 'servo_chaser', 'piston_anchor', 'circuit_swarm'],
      'acts/act7_machine/level1_enemies': ['self_reference', 'axiom_breaker', 'infinite_regress'],
      'acts/act7_machine/level2_enemies': ['ant_queen', 'emergence_node', 'swarm_cell'],
      'acts/act7_machine/level3_enemies': ['clockwork_soldier', 'bronze_gear', 'astronomical_dial'],
      'acts/act7_machine/level4_enemies': ['time_arrow', 'loop_guardian', 'recursion_echo'],

      // Act 8: Signals - Paranoia/cosmic theme
      'acts/act8_signals/bg': [
        'act8_bg_static',
        'act8_bg_void',
        'act8_bg_signal_towers',
        'act8_bg_distant_stars',
        'act8_bg_neural_static',
        'level1_office',
        'level1_files',
        'level1_redacted',
        'level2_parade',
        'level2_banners',
        'level2_static',
        'level3_night',
        'level3_stars',
        'level3_ufo',
        'level4_void',
        'level4_distant_stars',
        'level4_signal',
      ],
      'acts/act8_signals/enemies': ['redacted_agent', 'numbers_broadcaster', 'grey_visitor', 'signal_phantom'],
      'acts/act8_signals/level1_enemies': ['redacted_agent', 'shadow_operative', 'file_shredder'],
      'acts/act8_signals/level2_enemies': ['kgb_handler', 'propaganda_drone', 'numbers_station'],
      'acts/act8_signals/level3_enemies': ['grey_visitor', 'tractor_beam', 'implant_seeker'],
      'acts/act8_signals/level4_enemies': ['cosmic_silence', 'dark_forest_hunter', 'filter_survivor'],

      // Expansion: Samurai (3 levels)
      'expansions/samurai/level1_enemies': ['dishonored_ronin', 'broken_oath', 'wandering_blade'],
      'expansions/samurai/level2_enemies': ['oni_mask', 'demon_rage', 'corruption_spirit'],
      'expansions/samurai/level3_enemies': ['shadow_ninja', 'smoke_bomb', 'hidden_blade'],
      'expansions/samurai/bg': [
        'level1_dojo',
        'level1_tatami',
        'level1_katana',
        'level2_mountain',
        'level2_temple',
        'level2_mist',
        'level3_castle',
        'level3_night',
        'level3_moon',
      ],

      // Expansion: Travel (3 levels)
      'expansions/travel/level1_enemies': ['guardian_statue', 'sand_spirit', 'hieroglyph_curse'],
      'expansions/travel/level2_enemies': ['jungle_vine', 'lost_explorer', 'temple_trap'],
      'expansions/travel/level3_enemies': ['mountain_yeti', 'avalanche_spirit', 'frozen_climber'],
      'expansions/travel/bg': [
        'level1_pyramid',
        'level1_sand',
        'level1_obelisk',
        'level2_jungle',
        'level2_temple',
        'level2_vines',
        'level3_mountain',
        'level3_snow',
        'level3_peak',
      ],

      // Expansion: Cosmic (4 levels)
      'expansions/cosmic/level1_enemies': ['eldritch_eye', 'tentacle_mass', 'geometry_horror'],
      'expansions/cosmic/level2_enemies': ['star_spawn', 'void_walker', 'dimension_rift'],
      'expansions/cosmic/level3_enemies': ['cosmic_horror', 'entropy_cloud', 'reality_tear'],
      'expansions/cosmic/level4_enemies': ['elder_thing', 'shoggoth_fragment', 'mi_go_drone'],
      'expansions/cosmic/bg': [
        'level1_void',
        'level1_stars',
        'level1_nebula',
        'level2_dimension',
        'level2_rift',
        'level2_chaos',
        'level3_entropy',
        'level3_decay',
        'level3_end',
        'level4_antarctica',
        'level4_ice',
        'level4_ruins',
      ],

      // Expansion: Lost Worlds (5 levels)
      'expansions/lost_worlds/level1_enemies': ['atlantean_guard', 'coral_golem', 'trident_bearer'],
      'expansions/lost_worlds/level2_enemies': ['lemuria_shade', 'crystal_sentinel', 'sunken_priest'],
      'expansions/lost_worlds/level3_enemies': ['hyperborean_giant', 'ice_wraith', 'frozen_sage'],
      'expansions/lost_worlds/level4_enemies': ['mu_guardian', 'psychic_priest', 'thought_form'],
      'expansions/lost_worlds/level5_enemies': ['hollow_dweller', 'inner_sun_ray', 'subterranean_beast'],
      'expansions/lost_worlds/bg': [
        'level1_atlantis',
        'level1_dome',
        'level1_coral',
        'level2_lemuria',
        'level2_crystals',
        'level2_glow',
        'level3_hyperborea',
        'level3_ice',
        'level3_aurora',
        'level4_mu',
        'level4_temple',
        'level4_psychic',
        'level5_hollow',
        'level5_inner_sun',
        'level5_caves',
      ],

      // Expansion: Monkey Vars (6 levels)
      'expansions/monkey_vars/level1_enemies': ['alpha_silverback', 'chest_beater', 'dominance_display'],
      'expansions/monkey_vars/level2_enemies': ['cyber_chimp', 'neural_link', 'data_stream'],
      'expansions/monkey_vars/level3_enemies': ['shadow_monkey', 'dark_mirror', 'repressed_self'],
      'expansions/monkey_vars/level4_enemies': ['ancestral_ape', 'evolution_echo', 'primal_urge'],
      'expansions/monkey_vars/level5_enemies': ['quantum_monkey', 'probability_wave', 'observer_effect'],
      'expansions/monkey_vars/level6_enemies': ['enlightened_ape', 'buddha_nature', 'compassion_ray'],
      'expansions/monkey_vars/bg': [
        'level1_jungle',
        'level1_canopy',
        'level1_vines',
        'level2_lab',
        'level2_wires',
        'level2_screens',
        'level3_mirror',
        'level3_darkness',
        'level3_reflection',
        'level4_savanna',
        'level4_bones',
        'level4_sunset',
        'level5_quantum',
        'level5_particles',
        'level5_wave',
        'level6_temple',
        'level6_lotus',
        'level6_light',
      ],

      // Expansion: Climax (7 levels)
      'expansions/climax/level1_enemies': ['ego_fragment', 'identity_shard', 'mask_piece'],
      'expansions/climax/level2_enemies': ['memory_ghost', 'past_self', 'regret_form'],
      'expansions/climax/level3_enemies': ['fear_incarnate', 'anxiety_spiral', 'panic_wave'],
      'expansions/climax/level4_enemies': ['desire_demon', 'attachment_chain', 'craving_void'],
      'expansions/climax/level5_enemies': ['doubt_shadow', 'uncertainty_fog', 'confusion_maze'],
      'expansions/climax/level6_enemies': ['anger_flame', 'resentment_ember', 'fury_storm'],
      'expansions/climax/level7_enemies': ['final_self', 'ultimate_truth', 'liberation_light'],
      'expansions/climax/bg': [
        'level1_ego',
        'level1_mirrors',
        'level1_fragments',
        'level2_memory',
        'level2_photos',
        'level2_timeline',
        'level3_fear',
        'level3_shadows',
        'level3_spiral',
        'level4_desire',
        'level4_chains',
        'level4_void',
        'level5_doubt',
        'level5_fog',
        'level5_maze',
        'level6_anger',
        'level6_flames',
        'level6_storm',
        'level7_liberation',
        'level7_light',
        'level7_peace',
      ],

      // Expansion: State (7 levels)
      'expansions/state/level1_enemies': ['surveillance_drone', 'camera_eye', 'data_harvester'],
      'expansions/state/level2_enemies': ['propaganda_speaker', 'newspeak_bot', 'doublethink_agent'],
      'expansions/state/level3_enemies': ['riot_police', 'tear_gas_cloud', 'shield_wall'],
      'expansions/state/level4_enemies': ['corporate_drone', 'profit_seeker', 'shareholder_ghost'],
      'expansions/state/level5_enemies': ['algorithm_spirit', 'recommendation_demon', 'filter_bubble'],
      'expansions/state/level6_enemies': ['military_bot', 'drone_strike', 'collateral_ghost'],
      'expansions/state/level7_enemies': ['free_thinker', 'resistance_cell', 'hope_spark'],
      'expansions/state/bg': [
        'level1_surveillance',
        'level1_cameras',
        'level1_screens',
        'level2_ministry',
        'level2_speakers',
        'level2_posters',
        'level3_street',
        'level3_barricade',
        'level3_smoke',
        'level4_office',
        'level4_cubicles',
        'level4_graphs',
        'level5_feed',
        'level5_bubbles',
        'level5_likes',
        'level6_battlefield',
        'level6_drones',
        'level6_ruins',
        'level7_underground',
        'level7_candles',
        'level7_hope',
      ],

      // Expansion: Art (9 levels)
      'expansions/art/level1_enemies': ['cave_painter', 'ochre_spirit', 'handprint_ghost'],
      'expansions/art/level2_enemies': ['hieroglyph_scribe', 'anubis_shadow', 'papyrus_scroll'],
      'expansions/art/level3_enemies': ['byzantine_icon', 'gold_leaf_spirit', 'mosaic_fragment'],
      'expansions/art/level4_enemies': ['renaissance_master', 'perspective_trap', 'sfumato_ghost'],
      'expansions/art/level5_enemies': ['baroque_cherub', 'chiaroscuro_shadow', 'dramatic_pose'],
      'expansions/art/level6_enemies': ['impressionist_dot', 'light_fragment', 'color_blur'],
      'expansions/art/level7_enemies': ['cubist_fragment', 'multiple_perspective', 'geometric_form'],
      'expansions/art/level8_enemies': ['surrealist_dream', 'melting_form', 'unconscious_image'],
      'expansions/art/level9_enemies': ['abstract_expression', 'pure_color', 'emotional_splash'],
      'expansions/art/bg': [
        'level1_cave',
        'level1_torches',
        'level1_ochre',
        'level2_tomb',
        'level2_columns',
        'level2_gold',
        'level3_cathedral',
        'level3_mosaic',
        'level3_dome',
        'level4_studio',
        'level4_canvas',
        'level4_perspective',
        'level5_palace',
        'level5_drama',
        'level5_light',
        'level6_garden',
        'level6_water',
        'level6_sunlight',
        'level7_studio',
        'level7_angles',
        'level7_fragments',
        'level8_desert',
        'level8_clocks',
        'level8_elephants',
        'level9_canvas',
        'level9_drips',
        'level9_emotion',
      ],

      // Expansion: Science (10 levels)
      'expansions/science/level1_enemies': ['quark', 'lepton', 'boson'],
      'expansions/science/level2_enemies': ['dna_strand', 'rna_messenger', 'protein_folder'],
      'expansions/science/level3_enemies': ['neuron', 'synapse_spark', 'thought_pattern'],
      'expansions/science/level4_enemies': ['black_hole', 'event_horizon', 'hawking_radiation'],
      'expansions/science/level5_enemies': ['schrodinger_cat', 'wave_function', 'observer'],
      'expansions/science/level6_enemies': ['entropy_demon', 'heat_death', 'order_decay'],
      'expansions/science/level7_enemies': ['dark_matter', 'dark_energy', 'cosmic_web'],
      'expansions/science/level8_enemies': ['multiverse_branch', 'parallel_self', 'quantum_split'],
      'expansions/science/level9_enemies': ['singularity', 'ai_emergence', 'recursive_improvement'],
      'expansions/science/level10_enemies': ['unified_theory', 'theory_of_everything', 'final_equation'],
      'expansions/science/bg': [
        'level1_accelerator',
        'level1_particles',
        'level1_tracks',
        'level2_helix',
        'level2_cells',
        'level2_lab',
        'level3_brain',
        'level3_neurons',
        'level3_signals',
        'level4_space',
        'level4_distortion',
        'level4_accretion',
        'level5_lab',
        'level5_box',
        'level5_probability',
        'level6_universe',
        'level6_decay',
        'level6_cold',
        'level7_cosmos',
        'level7_filaments',
        'level7_voids',
        'level8_branches',
        'level8_splits',
        'level8_parallels',
        'level9_circuits',
        'level9_networks',
        'level9_emergence',
        'level10_equations',
        'level10_unity',
        'level10_light',
      ],

      // Expansion: Paranoia (11 levels)
      'expansions/paranoia/level1_enemies': ['shadow_watcher', 'corner_eye', 'followed_feeling'],
      'expansions/paranoia/level2_enemies': ['hidden_camera', 'listening_device', 'data_collector'],
      'expansions/paranoia/level3_enemies': ['man_in_black', 'unmarked_van', 'silence_enforcer'],
      'expansions/paranoia/level4_enemies': ['implant', 'control_signal', 'behavior_modifier'],
      'expansions/paranoia/level5_enemies': ['illuminati_eye', 'pyramid_shadow', 'hidden_hand'],
      'expansions/paranoia/level6_enemies': ['reptilian', 'shapeshifter', 'infiltrator'],
      'expansions/paranoia/level7_enemies': ['chemtrail', 'aerial_spray', 'mind_fog'],
      'expansions/paranoia/level8_enemies': ['crisis_actor', 'false_flag', 'manufactured_event'],
      'expansions/paranoia/level9_enemies': ['deep_state', 'shadow_government', 'puppet_master'],
      'expansions/paranoia/level10_enemies': ['reality_manipulator', 'simulation_glitch', 'matrix_agent'],
      'expansions/paranoia/level11_enemies': ['truth_seeker', 'pattern_finder', 'awake_mind'],
      'expansions/paranoia/bg': [
        'level1_street',
        'level1_shadows',
        'level1_eyes',
        'level2_room',
        'level2_devices',
        'level2_wires',
        'level3_office',
        'level3_suits',
        'level3_cars',
        'level4_lab',
        'level4_signals',
        'level4_screens',
        'level5_temple',
        'level5_symbols',
        'level5_pyramid',
        'level6_chamber',
        'level6_thrones',
        'level6_masks',
        'level7_sky',
        'level7_planes',
        'level7_trails',
        'level8_studio',
        'level8_props',
        'level8_cameras',
        'level9_bunker',
        'level9_maps',
        'level9_strings',
        'level10_code',
        'level10_matrix',
        'level10_glitches',
        'level11_light',
        'level11_truth',
        'level11_awakening',
      ],

      // Expansion: Myth (15 levels)
      'expansions/myth/level1_enemies': ['humbaba', 'bull_of_heaven', 'utnapishtim'],
      'expansions/myth/level2_enemies': ['ammit', 'scale_keeper', 'ba_soul'],
      'expansions/myth/level3_enemies': ['vritra', 'soma_drop', 'rta_pattern'],
      'expansions/myth/level4_enemies': ['maya_illusion', 'ego_demon', 'samsara_wheel'],
      'expansions/myth/level5_enemies': ['doubt_warrior', 'attachment_chain', 'vishvarupa'],
      'expansions/myth/level6_enemies': ['striving_demon', 'naming_trap', 'uncarved_block'],
      'expansions/myth/level7_enemies': ['logical_mind', 'mu_response', 'sudden_awakening'],
      'expansions/myth/level8_enemies': ['peaceful_deity', 'wrathful_deity', 'rebirth_pull'],
      'expansions/myth/level9_enemies': ['klipot_shell', 'sefira_guardian', 'ein_sof_light'],
      'expansions/myth/level10_enemies': ['demiurge', 'archon', 'divine_spark'],
      'expansions/myth/level11_enemies': ['separation', 'ego_veil', 'beloved'],
      'expansions/myth/level12_enemies': ['fenrir', 'jormungandr', 'surtr'],
      'expansions/myth/level13_enemies': ['death_lord', 'ball_game_foe', 'mosquito_spy'],
      'expansions/myth/level14_enemies': ['rainbow_serpent', 'ancestor_spirit', 'sacred_site'],
      'expansions/myth/level15_enemies': ['power_animal', 'spirit_illness', 'world_tree'],
      'expansions/myth/bg': [
        'level1_uruk',
        'level1_cedar_forest',
        'level1_ziggurats',
        'level2_duat',
        'level2_scales',
        'level2_hieroglyphs',
        'level3_fire_altar',
        'level3_sanskrit',
        'level3_cosmic_waters',
        'level4_ashram',
        'level4_forest',
        'level4_om_symbol',
        'level5_kurukshetra',
        'level5_armies',
        'level5_chariot',
        'level6_mountain',
        'level6_mist',
        'level6_yin_yang',
        'level7_zen_garden',
        'level7_raked_sand',
        'level7_enso',
        'level8_bardo_realm',
        'level8_mandalas',
        'level8_clear_light',
        'level9_tree_of_life',
        'level9_hebrew_letters',
        'level9_divine_light',
        'level10_archonic_spheres',
        'level10_pleroma',
        'level10_sophia',
        'level11_konya',
        'level11_whirling',
        'level11_rose',
        'level12_yggdrasil',
        'level12_asgard',
        'level12_flames',
        'level13_xibalba',
        'level13_ball_court',
        'level13_pyramid',
        'level14_outback',
        'level14_rock_art',
        'level14_stars',
        'level15_world_tree',
        'level15_spirit_realm',
        'level15_drums',
      ],

      // Expansion: Literature (20 levels)
      'expansions/literature/level1_enemies': ['shadow_prisoner', 'fire_keeper', 'escaped_philosopher'],
      'expansions/literature/level2_enemies': ['substance', 'accident', 'syllogism'],
      'expansions/literature/level3_enemies': ['minos', 'sinner', 'virgil_guide'],
      'expansions/literature/level4_enemies': ['penitent', 'guardian_angel', 'earthly_paradise'],
      'expansions/literature/level5_enemies': ['beatrice', 'celestial_sphere', 'divine_vision'],
      'expansions/literature/level6_enemies': ['gregor_insect', 'disapproving_family', 'chief_clerk'],
      'expansions/literature/level7_enemies': ['josef_k', 'court_official', 'doorkeeper'],
      'expansions/literature/level8_enemies': ['k_surveyor', 'castle_official', 'barnabas_messenger'],
      'expansions/literature/level9_enemies': ['ts_tsun', 'forking_path', 'stephen_albert'],
      'expansions/literature/level10_enemies': ['librarian', 'book_hunter', 'gibberish_tome'],
      'expansions/literature/level11_enemies': ['carlos_argentino', 'aleph_point', 'beatriz_viterbo'],
      'expansions/literature/level12_enemies': ['leopold_bloom', 'stephen_dedalus', 'molly_yes'],
      'expansions/literature/level13_enemies': ['hce', 'alp', 'shem_shaun'],
      'expansions/literature/level14_enemies': ['underground_man', 'crystal_palace', 'liza'],
      'expansions/literature/level15_enemies': ['grand_inquisitor', 'ivan_karamazov', 'alyosha'],
      'expansions/literature/level16_enemies': ['zarathustra', 'last_man', 'camel_lion_child'],
      'expansions/literature/level17_enemies': ['idol', 'hammer', 'true_world'],
      'expansions/literature/level18_enemies': ['sisyphus', 'absurd', 'meursault'],
      'expansions/literature/level19_enemies': ['roquentin', 'chestnut_root', 'self_taught_man'],
      'expansions/literature/level20_enemies': ['proposition', 'mystical', 'ladder'],
      'expansions/literature/bg': [
        'level1_cave',
        'level1_shadows',
        'level1_fire',
        'level2_lyceum',
        'level2_scrolls',
        'level2_columns',
        'level3_hell_gates',
        'level3_circles',
        'level3_flames',
        'level4_mountain',
        'level4_terraces',
        'level4_stars',
        'level5_spheres',
        'level5_light',
        'level5_rose',
        'level6_bedroom',
        'level6_furniture',
        'level6_apple',
        'level7_courthouse',
        'level7_corridors',
        'level7_door',
        'level8_village',
        'level8_snow',
        'level8_castle_distant',
        'level9_garden',
        'level9_paths',
        'level9_maze',
        'level10_hexagons',
        'level10_shelves',
        'level10_books',
        'level11_cellar',
        'level11_aleph_glow',
        'level11_universe',
        'level12_dublin',
        'level12_streets',
        'level12_tower',
        'level13_liffey',
        'level13_dreamscape',
        'level13_cycle',
        'level14_mousehole',
        'level14_st_petersburg',
        'level14_wall',
        'level15_monastery',
        'level15_russia',
        'level15_icon',
        'level16_mountain',
        'level16_cave',
        'level16_sunrise',
        'level17_columns',
        'level17_broken_statues',
        'level17_twilight',
        'level18_hill',
        'level18_boulder',
        'level18_summit',
        'level19_bouville',
        'level19_park',
        'level19_tree',
        'level20_logical_space',
        'level20_ladder',
        'level20_silence',
      ],
    };

    const loadPromises: Promise<SvgAsset | null>[] = [];

    for (const [folder, files] of Object.entries(manifest)) {
      for (const file of files) {
        const id = `${folder}/${file}`;
        const path = `${this.basePath}/${folder}/${file}.svg`;
        loadPromises.push(this.load(id, path).catch(() => null));
      }
    }

    await Promise.all(loadPromises);
    console.log(`SVG Assets loaded: ${this.assets.size}`);
  }

  /**
   * Get enemies available for a specific act
   */
  getActEnemies(actId: string): string[] {
    const actEnemyMap: Record<string, string[]> = {
      act1_escape: ['bureaucrat_drone', 'lab_chaser', 'swarm_cell'],
      act2_ocean: ['depth_drifter', 'angler_chaser', 'pearl_courier', 'echo_swarm'],
      act3_heroic: ['bronze_hoplite', 'harpy_swarm', 'fate_spinner', 'oracle_eye'],
      act4_sacred: ['dharma_wheel', 'prayer_swarm', 'incense_anchor', 'lotus_phaser'],
      act5_painted: ['fruit_drifter', 'paint_splatter', 'brush_weaver', 'portrait_mimic'],
      act6_library: ['index_card', 'footnote_swarm', 'paradox_splitter', 'cipher_shield'],
      act7_machine: ['gear_drifter', 'servo_chaser', 'piston_anchor', 'circuit_swarm'],
      act8_signals: ['redacted_agent', 'numbers_broadcaster', 'grey_visitor', 'signal_phantom'],
    };
    return actEnemyMap[actId] || [];
  }

  /**
   * Get the SVG path for an act-specific enemy
   */
  getActEnemySvgId(actId: string, enemyName: string): string {
    return `acts/${actId}/enemies/${enemyName}`;
  }

  /**
   * Get the SVG path for a level-specific enemy
   */
  getLevelEnemySvgId(actId: string, levelIndex: number, enemyName: string): string {
    return `acts/${actId}/level${levelIndex}_enemies/${enemyName}`;
  }

  /**
   * Check if a level-specific enemy SVG exists
   */
  hasLevelEnemy(actId: string, levelIndex: number, enemyName: string): boolean {
    const svgId = this.getLevelEnemySvgId(actId, levelIndex, enemyName);
    const asset = this.get(svgId);
    return asset?.loaded ?? false;
  }

  /**
   * Get background SVG IDs for an act
   */
  getActBackgrounds(actId: string): string[] {
    const bgMap: Record<string, string[]> = {
      act1_escape: [
        'acts/act1_escape/bg/act1_bg_grid',
        'acts/act1_escape/bg/act1_bg_bars',
        'acts/act1_escape/bg/act1_bg_warning',
      ],
      act2_ocean: [
        'acts/act2_ocean/bg/act2_bg_abyss',
        'acts/act2_ocean/bg/act2_bg_kelp',
        'acts/act2_ocean/bg/act2_bg_bubbles',
      ],
      act3_heroic: [
        'acts/act3_heroic/bg/act3_bg_columns',
        'acts/act3_heroic/bg/act3_bg_stars',
        'acts/act3_heroic/bg/act3_bg_laurel',
      ],
      act4_sacred: [
        'acts/act4_sacred/bg/act4_bg_mandala',
        'acts/act4_sacred/bg/act4_bg_stained_glass',
        'acts/act4_sacred/bg/act4_bg_incense',
      ],
      act5_painted: [
        'acts/act5_painted/bg/act5_bg_canvas',
        'acts/act5_painted/bg/act5_bg_brushstrokes',
        'acts/act5_painted/bg/act5_bg_surreal',
      ],
      act6_library: [
        'acts/act6_library/bg/act6_bg_bookshelves',
        'acts/act6_library/bg/act6_bg_paradox',
        'acts/act6_library/bg/act6_bg_manuscript',
      ],
      act7_machine: [
        'acts/act7_machine/bg/act7_bg_gears',
        'acts/act7_machine/bg/act7_bg_circuits',
        'acts/act7_machine/bg/act7_bg_pistons',
      ],
      act8_signals: [
        'acts/act8_signals/bg/act8_bg_static',
        'acts/act8_signals/bg/act8_bg_void',
        'acts/act8_signals/bg/act8_bg_signal_towers',
      ],
    };
    return bgMap[actId] || [];
  }

  /**
   * Get enemies available for a specific expansion
   */
  getExpansionEnemies(expansionId: string): string[] {
    const expansionEnemyMap: Record<string, string[]> = {
      art: ['enemy_living_painting', 'enemy_cave_spirit', 'enemy_auroch_ghost', 'enemy_handprint_swarm'],
      cosmic: ['enemy_eldritch_eye', 'enemy_cultist', 'enemy_star_spawn', 'enemy_deep_one'],
      literature: ['enemy_cockroach', 'enemy_shadow_figure', 'enemy_labyrinth_beast', 'enemy_infinite_book'],
      lost_worlds: ['enemy_stone_golem', 'enemy_crystal_sentinel', 'enemy_jungle_wraith', 'enemy_temple_scarab'],
      myth: ['enemy_atlantean_guardian', 'enemy_siren', 'enemy_cerberus_head', 'enemy_phoenix_ember'],
      science: ['enemy_quantum_particle', 'enemy_neural_network', 'enemy_black_hole', 'enemy_dna_strand'],
      monkey_vars: ['enemy_alpha_ape', 'enemy_cyber_chimp', 'enemy_shadow_monkey', 'enemy_baby_monkey'],
      climax: ['enemy_final_form', 'enemy_void_tendril', 'enemy_ego_shard', 'enemy_memory_ghost'],
      state: ['enemy_surveillance_drone', 'enemy_riot_bot', 'enemy_propaganda_speaker', 'enemy_censor_bot'],
      samurai: ['enemy_ronin', 'enemy_oni_mask', 'enemy_shadow_ninja', 'enemy_paper_spirit'],
      paranoia: ['enemy_men_in_black', 'enemy_shadow_agent', 'enemy_surveillance_eye', 'enemy_black_helicopter'],
      travel: ['enemy_guardian_statue', 'enemy_desert_djinn', 'enemy_time_phantom', 'enemy_compass_wisp'],
    };
    return expansionEnemyMap[expansionId] || [];
  }

  /**
   * Get the SVG path for an expansion-specific enemy
   */
  getExpansionEnemySvgId(expansionId: string, enemyName: string): string {
    return `expansions/${expansionId}/${enemyName}`;
  }

  /**
   * Load a single SVG asset
   */
  async load(id: string, path: string): Promise<SvgAsset> {
    // Return cached
    if (this.assets.has(id)) {
      return this.assets.get(id)!;
    }

    // Return pending promise
    if (this.loadPromises.has(id)) {
      return this.loadPromises.get(id)!;
    }

    // Create new load promise
    const promise = new Promise<SvgAsset>((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const asset: SvgAsset = {
          id,
          image: img,
          width: img.naturalWidth || 64,
          height: img.naturalHeight || 64,
          loaded: true,
        };
        this.assets.set(id, asset);
        this.loadPromises.delete(id);
        resolve(asset);
      };

      img.onerror = () => {
        this.loadPromises.delete(id);
        reject(new Error(`Failed to load SVG: ${path}`));
      };

      img.src = path;
    });

    this.loadPromises.set(id, promise);
    return promise;
  }

  /**
   * Get a loaded asset by ID
   */
  get(id: string): SvgAsset | undefined {
    return this.assets.get(id);
  }

  /**
   * Check if an asset is loaded
   */
  has(id: string): boolean {
    return this.assets.has(id);
  }

  /**
   * Render an SVG asset to canvas
   */
  render(ctx: CanvasRenderingContext2D, id: string, options: SvgRenderOptions): boolean {
    const asset = this.assets.get(id);
    if (!asset || !asset.loaded) {
      return false;
    }

    const {
      x,
      y,
      width = asset.width,
      height = asset.height,
      rotation = 0,
      alpha = 1,
      glow = 0,
      glowColor = '#ffffff',
    } = options;

    ctx.save();

    // Apply transformations
    ctx.translate(x, y);
    if (rotation !== 0) {
      ctx.rotate(rotation);
    }

    // Apply alpha
    ctx.globalAlpha = alpha;

    // Apply glow effect
    if (glow > 0) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = glow;
    }

    // Draw centered
    ctx.drawImage(asset.image, -width / 2, -height / 2, width, height);

    ctx.restore();
    return true;
  }

  /**
   * Render with animation frame (for sprite sheets or time-based variations)
   */
  renderAnimated(ctx: CanvasRenderingContext2D, baseId: string, _frame: number, options: SvgRenderOptions): boolean {
    // For now, just render the base asset
    // Can be extended for sprite sheet support
    return this.render(ctx, baseId, options);
  }

  /**
   * Get asset dimensions
   */
  getDimensions(id: string): { width: number; height: number } | undefined {
    const asset = this.assets.get(id);
    if (!asset) return undefined;
    return { width: asset.width, height: asset.height };
  }

  /**
   * Clear all cached assets
   */
  clear(): void {
    this.assets.clear();
    this.loadPromises.clear();
  }
}

// Global instance
export const svgAssets = new SvgAssetManager();
